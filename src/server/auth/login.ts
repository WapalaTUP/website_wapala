import "server-only";
import { getDb } from "../db";
import { DomainError } from "../errors";
import { verifyPassword, dummyHash } from "../security/password";
import { newToken, digestToken } from "../security/tokens";
import { csrfForSession } from "../security/csrf";
import { takeThrottle } from "../security/throttle";
import type { RequestContext } from "../security/request-context";
import { writeAudit } from "../audit";
export async function login(
  input: { email: string; password: string },
  ctx: RequestContext,
) {
  const email = input.email.trim().toLowerCase();
  await takeThrottle("login-ip:" + ctx.ipDigest, 20, 900000);
  await takeThrottle("login-email:" + email, 10, 900000);
  const snapshot = await getDb().user.findUnique({ where: { email } });
  const valid = await verifyPassword(
    snapshot?.passwordHash || (await dummyHash()),
    input.password,
  );
  const token = newToken(),
    csrfToken = csrfForSession(token),
    expiresAt = new Date(Date.now() + 30 * 86400000);
  const result = await getDb().$transaction(async (tx) => {
    if (!snapshot) {
      await writeAudit(tx, {
        actorType: "ANONYMOUS",
        action: "LOGIN_REJECTED",
        context: ctx,
      });
      return null;
    }
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${snapshot.id}::uuid FOR UPDATE`;
    const user = await tx.user.findUniqueOrThrow({
        where: { id: snapshot.id },
      }),
      now = new Date();
    const locked =
      user.requiresUnlock || !!(user.lockUntil && user.lockUntil > now);
    if (
      !valid ||
      locked ||
      !user.active ||
      user.archivedAt ||
      user.passwordHash !== snapshot.passwordHash
    ) {
      if (!valid && !locked && user.active && !user.archivedAt) {
        const count = user.failedLoginCount + 1;
        await tx.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount: count,
            lockUntil:
              count === 3 ? new Date(Date.now() + 900000) : user.lockUntil,
            requiresUnlock: count >= 6,
          },
        });
      }
      await writeAudit(tx, {
        actorType: "ANONYMOUS",
        action: "LOGIN_REJECTED",
        entityId: user.id,
        context: ctx,
      });
      return null;
    }
    await tx.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockUntil: null },
    });
    const session = await tx.session.create({
      data: {
        userId: user.id,
        tokenHash: digestToken(token),
        csrfDigest: digestToken(csrfToken),
        credentialVersion: user.credentialVersion,
        expiresAt,
      },
    });
    await writeAudit(tx, {
      actorType: "USER",
      actorId: user.id,
      action: "LOGIN_SUCCEEDED",
      context: ctx,
    });
    return {
      userId: user.id,
      sessionId: session.id,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
  });
  if (!result)
    throw new DomainError(
      "LOGIN_FAILED",
      401,
      "Email atau password tidak sesuai, atau akses belum tersedia.",
    );
  return { token, csrfToken, principal: result, expiresAt };
}
