import "server-only";
import type { Prisma } from "../../generated/prisma/client";
import { getDb } from "../db";
import { DomainError } from "../errors";
import { digestToken } from "../security/tokens";
import { hashPassword, verifyPassword } from "../security/password";
import type { RequestContext } from "../security/request-context";
import { writeAudit } from "../audit";
import { loginLockPrefixFor } from "../security/throttle";
import { requirePermission, type Permission, type Principal } from "./policy";
const sessionWithUser = {
  id: true,
  userId: true,
  revokedAt: true,
  expiresAt: true,
  credentialVersion: true,
  user: {
    select: {
      active: true,
      archivedAt: true,
      credentialVersion: true,
      role: true,
      mustChangePassword: true,
    },
  },
} as const;
export async function resolveSessionRecord(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const session = await getDb().session.findUnique({
    where: { tokenHash: digestToken(token) },
    select: { ...sessionWithUser, csrfDigest: true },
  });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    !session.user.active ||
    session.user.archivedAt ||
    session.credentialVersion !== session.user.credentialVersion
  )
    return null;
  return {
    principal: {
      userId: session.userId,
      sessionId: session.id,
      role: session.user.role,
      mustChangePassword: session.user.mustChangePassword,
    },
    csrfDigest: session.csrfDigest,
  };
}
export async function resolveSession(token: string): Promise<Principal | null> {
  const record = await resolveSessionRecord(token);
  return record?.principal ?? null;
}
export async function assertFresh(
  tx: Prisma.TransactionClient,
  principal: Principal,
  permission?: Permission,
) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${principal.userId}::uuid FOR UPDATE`;
  const session = await tx.session.findUnique({
    where: { id: principal.sessionId },
    include: { user: true },
  });
  if (
    !session ||
    session.userId !== principal.userId ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    !session.user.active ||
    session.user.archivedAt ||
    session.credentialVersion !== session.user.credentialVersion ||
    session.user.role !== principal.role
  )
    throw new DomainError("UNAUTHENTICATED", 401);
  const fresh = {
    ...principal,
    mustChangePassword: session.user.mustChangePassword,
  };
  if (permission) requirePermission(fresh, permission);
  return session.user;
}
// Varian tanpa baris-lock untuk jalur baca murni (mis. serving media):
// tidak menahan "User" FOR UPDATE sehingga tidak mengantre di pool DB.
export async function assertFreshRead(
  tx: Prisma.TransactionClient,
  principal: Principal,
  permission?: Permission,
) {
  const session = await tx.session.findUnique({
    where: { id: principal.sessionId },
    select: sessionWithUser,
  });
  if (
    !session ||
    session.userId !== principal.userId ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    !session.user.active ||
    session.user.archivedAt ||
    session.credentialVersion !== session.user.credentialVersion ||
    session.user.role !== principal.role
  )
    throw new DomainError("UNAUTHENTICATED", 401);
  const fresh = {
    ...principal,
    mustChangePassword: session.user.mustChangePassword,
  };
  if (permission) requirePermission(fresh, permission);
  return session.user;
}
export async function logout(token: string, ctx: RequestContext) {
  const principal = await resolveSession(token);
  if (!principal) return;
  await getDb().$transaction(async (tx) => {
    await assertFresh(tx, principal);
    await tx.session.update({
      where: { id: principal.sessionId },
      data: { revokedAt: new Date() },
    });
    await writeAudit(tx, {
      actorType: "USER",
      actorId: principal.userId,
      action: "LOGOUT",
      context: ctx,
    });
  });
}export async function changePassword(
  principal: Principal,
  input: { currentPassword: string; newPassword: string },
  ctx: RequestContext,
) {
  const old = await getDb().user.findUniqueOrThrow({
    where: { id: principal.userId },
  });
  if (!(await verifyPassword(old.passwordHash, input.currentPassword)))
    throw new DomainError(
      "PASSWORD_INVALID",
      400,
      "Password saat ini tidak sesuai.",
    );
  if (input.currentPassword === input.newPassword)
    throw new DomainError(
      "PASSWORD_UNCHANGED",
      400,
      "Password baru harus berbeda dari password saat ini.",
    );
  const passwordHash = await hashPassword(input.newPassword);
  await getDb().$transaction(async (tx) => {
    const current = await assertFresh(tx, principal);
    if (current.passwordHash !== old.passwordHash)
      throw new DomainError("UNAUTHENTICATED", 401);
    await tx.user.update({
      where: { id: principal.userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        credentialVersion: { increment: 1 },
        failedLoginCount: 0,
        lockUntil: null,
        requiresUnlock: false,
      },
    });
    await tx.session.updateMany({
      where: { userId: principal.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.passwordResetToken.updateMany({
      where: { userId: principal.userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.securityThrottle.deleteMany({
      where: { key: { startsWith: loginLockPrefixFor(old.email) } },
    });
    await writeAudit(tx, {
      actorType: "USER",
      actorId: principal.userId,
      action: "PASSWORD_CHANGED",
      context: ctx,
    });
  });
}
