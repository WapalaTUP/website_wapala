import "server-only";
import { getDb } from "../db";
import { seedFoundation } from "../foundation-seed";
import { DomainError } from "../errors";
import { newToken, digestToken, constantEqual } from "../security/tokens";
import { hashPassword } from "../security/password";
import type { RequestContext } from "../security/request-context";
import { writeAudit } from "../audit";
export async function setupRequired() {
  return !(await getDb().bootstrapState.findUnique({ where: { id: 1 } }))?.completedAt;
}
export async function createBootstrapToken(ctx: RequestContext) {
  await seedFoundation();
  const token = newToken(),
    expiresAt = new Date(Date.now() + 1800000);
  await getDb().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "BootstrapState" WHERE id=1 FOR UPDATE`;
    const state = await tx.bootstrapState.findUniqueOrThrow({
      where: { id: 1 },
    });
    if (state.completedAt || (await tx.user.count({ where: { role: "SUPER_USER" } })))
      throw new DomainError("SETUP_CLOSED", 409);
    await tx.bootstrapState.update({
      where: { id: 1 },
      data: { tokenHash: digestToken(token), expiresAt },
    });
    await writeAudit(tx, {
      actorType: "SERVER_OPERATOR",
      action: "BOOTSTRAP_TOKEN_CREATED",
      context: ctx,
    });
  });
  return { token, expiresAt };
}
export async function bootstrap(input: { token: string; password: string }, ctx: RequestContext) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(input.token)) throw new DomainError("SETUP_INVALID", 400);
  const passwordHash = await hashPassword(input.password);
  await getDb().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "BootstrapState" WHERE id=1 FOR UPDATE`;
    const state = await tx.bootstrapState.findUnique({ where: { id: 1 } });
    if (
      !state ||
      state.completedAt ||
      !state.tokenHash ||
      !state.expiresAt ||
      state.expiresAt <= new Date() ||
      !constantEqual(state.tokenHash, digestToken(input.token))
    )
      throw new DomainError("SETUP_INVALID", 400);
    if (await tx.user.count({ where: { role: "SUPER_USER" } }))
      throw new DomainError("SETUP_CLOSED", 409);
    const user = await tx.user.create({
      data: {
        email: "superuser@wapala.org",
        name: "Super User WAPALA",
        recoveryEmail: "Wapalatelkomuniversity@gmail.com",
        passwordHash,
        role: "SUPER_USER",
        mustChangePassword: false,
      },
    });
    await tx.bootstrapState.update({
      where: { id: 1 },
      data: { completedAt: new Date(), tokenHash: null, expiresAt: null },
    });
    await writeAudit(tx, {
      actorType: "USER",
      actorId: user.id,
      action: "BOOTSTRAP_COMPLETED",
      entityId: user.id,
      context: ctx,
    });
  });
}
