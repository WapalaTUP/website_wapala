import "server-only";
import { z } from "zod";
import { getDb } from "../db";
import { DomainError } from "../errors";
import { requirePermission, type Principal } from "../auth/policy";
import { assertFresh } from "../auth/sessions";
import { newToken } from "../security/tokens";
import { hashPassword } from "../security/password";
import { writeAudit } from "../audit";
import type { RequestContext } from "../security/request-context";
export const rolloverSchema = z
  .object({
    expectedYear: z.number().int().min(2004).max(2200),
    year: z.number().int().min(2004).max(2200),
    passwordChoices: z.array(z.object({ userId: z.uuid(), reset: z.boolean() }).strict()).max(100),
  })
  .strict()
  .refine(
    (v) =>
      v.year > v.expectedYear &&
      new Set(v.passwordChoices.map((c) => c.userId)).size === v.passwordChoices.length,
    { message: "Periksa tahun dan pilihan akun." },
  );
export async function rollover(principal: Principal, input: unknown, ctx: RequestContext) {
  requirePermission(principal, "users:write");
  const v = rolloverSchema.parse(input);
  const prepared = new Map<string, { temporaryPassword: string; passwordHash: string }>();
  for (const choice of v.passwordChoices.filter((c) => c.reset)) {
    const temporaryPassword = newToken();
    prepared.set(choice.userId, {
      temporaryPassword,
      passwordHash: await hashPassword(temporaryPassword),
    });
  }
  return getDb().$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('wapala:management'))::text`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(72615001)::text`;
      await assertFresh(tx, principal, "users:write");
      await tx.$queryRaw`SELECT id FROM "SiteSettings" WHERE id=1 FOR UPDATE`;
      const settings = await tx.siteSettings.findUniqueOrThrow({
        where: { id: 1 },
      });
      if (settings.managementYear !== v.expectedYear)
        throw new DomainError(
          "CONFLICT",
          409,
          "Periode telah berubah. Muat ulang sebelum melanjutkan.",
        );
      const credentials: Array<{
        userId: string;
        email: string;
        temporaryPassword: string;
      }> = [];
      for (const choice of [...v.passwordChoices].sort((a, b) =>
        a.userId.localeCompare(b.userId),
      )) {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id=${choice.userId}::uuid FOR UPDATE`;
        const target = await tx.user.findUnique({
          where: { id: choice.userId },
        });
        if (!target || target.role === "SUPER_USER" || !target.active || target.archivedAt)
          throw new DomainError(
            "RESET_UNAVAILABLE",
            409,
            "Super User dipulihkan melalui menu password terpisah; pilih admin aktif saja.",
          );
        if (!choice.reset) continue;
        const password = prepared.get(choice.userId)!;
        await tx.user.update({
          where: { id: target.id },
          data: {
            passwordHash: password.passwordHash,
            credentialVersion: { increment: 1 },
            mustChangePassword: true,
            failedLoginCount: 0,
            lockUntil: null,
            requiresUnlock: false,
          },
        });
        await tx.session.updateMany({
          where: { userId: target.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.passwordResetToken.updateMany({
          where: { userId: target.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        await writeAudit(tx, {
          actorType: "USER",
          actorId: principal.userId,
          action: "ADMIN_PASSWORD_RESET",
          entityId: target.id,
          context: ctx,
        });
        credentials.push({
          userId: target.id,
          email: target.email,
          temporaryPassword: password.temporaryPassword,
        });
      }
      const archived = await tx.loan.updateMany({
        where: {
          archivedAt: null,
          status: { in: ["returned", "rejected"] },
          penaltyStatus: { not: "pending" },
          collateralStatus: { not: "held" },
        },
        data: { archivedAt: new Date() },
      });
      const carried = await tx.loan.updateMany({
        where: { archivedAt: null },
        data: { managementYear: v.year },
      });
      await tx.siteSettings.update({
        where: { id: 1 },
        data: { managementYear: v.year },
      });
      await writeAudit(tx, {
        actorType: "USER",
        actorId: principal.userId,
        action: "MANAGEMENT_ROLLOVER",
        summary: {
          previousYear: v.expectedYear,
          year: v.year,
          archived: archived.count,
          carried: carried.count,
          resetAccounts: credentials.length,
        },
        context: ctx,
      });
      return {
        year: v.year,
        archived: archived.count,
        carried: carried.count,
        credentials,
      };
    },
    { timeout: 15000 },
  );
}
