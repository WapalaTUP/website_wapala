import "server-only";
import { getDb } from "../db";
import { getConfig } from "../config";
import { DomainError } from "../errors";
import { hmacToken } from "./tokens";
import { verifyPassword } from "./password";

const windowMs = 15 * 60 * 1000;
const failureLimit = 5;
type Result = { valid: true } | { valid: false; count: number; expiresAt: Date };
export function dataResetPasswordBucket(userId: string, now = Date.now()) {
  const bucket = Math.floor(now / windowMs);
  return {
    key: hmacToken(`data-reset-password-failures:v1:${userId}:${bucket}`, getConfig().securityKey),
    expiresAt: new Date((bucket + 1) * windowMs),
  };
}
export async function verifyDataResetPassword(
  user: { id: string; passwordHash: string },
  password: string,
) {
  // Count password failures, not successful deletions, previews, or stale snapshots.
  // A separate namespace also prevents old operation counters from blocking this flow.
  const result = await getDb().$transaction(async (tx): Promise<Result> => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"wapala:delete-password:" + user.id}))::text`;
    const { key, expiresAt } = dataResetPasswordBucket(user.id);
    const previous = await tx.securityThrottle.findUnique({ where: { key } });
    if (previous && previous.count >= failureLimit)
      return { valid: false, count: previous.count, expiresAt: previous.expiresAt };
    if (await verifyPassword(user.passwordHash, password)) {
      await tx.securityThrottle.deleteMany({ where: { key } });
      return { valid: true };
    }
    const failure = await tx.securityThrottle.upsert({
      where: { key },
      create: { key, count: 1, expiresAt },
      update: { count: { increment: 1 } },
    });
    // Return normally so the failure is committed before throwing below.
    return { valid: false, count: failure.count, expiresAt: failure.expiresAt };
  });
  if (result.valid) return;
  if (result.count >= failureLimit) {
    const seconds = Math.max(1, Math.ceil((result.expiresAt.getTime() - Date.now()) / 1000));
    throw new DomainError(
      "RATE_LIMIT",
      429,
      `Password otorisasi salah terlalu banyak kali. Coba lagi dalam ${Math.ceil(seconds / 60)} menit. Pemeriksaan data tidak menambah hitungan ini.`,
    );
  }
  throw new DomainError(
    "PASSWORD_INVALID",
    400,
    `Password Super User tidak sesuai. Tersisa ${failureLimit - result.count} percobaan password sebelum jeda sementara.`,
  );
}
