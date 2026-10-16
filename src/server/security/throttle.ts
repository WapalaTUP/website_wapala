import "server-only";
import { getDb } from "../db";
import { getConfig } from "../config";
import { DomainError } from "../errors";
import { hmacToken } from "./tokens";
export async function takeThrottle(key: string, limit: number, windowMs: number) {
  const bucket = Math.floor(Date.now() / windowMs),
    id = hmacToken("throttle:" + key + ":" + bucket, getConfig().securityKey),
    expiresAt = new Date((bucket + 1) * windowMs);
  const rows = await getDb().$queryRaw<
    Array<{ count: number }>
  >`INSERT INTO "SecurityThrottle" (key,count,"expiresAt") VALUES (${id},1,${expiresAt}) ON CONFLICT (key) DO UPDATE SET count="SecurityThrottle".count+1 RETURNING count`;
  if (rows[0].count > limit)
    throw new DomainError("RATE_LIMIT", 429, "Terlalu banyak percobaan. Coba kembali nanti.");
}
// Lock login per (email, IP): key disimpan mentah agar bisa dihapus
// terpilih saat panel unlock/pemulihan, tanpa membocorkan IP.
const loginLockPrefix = "login-lock:";
const loginLockKey = (email: string, ipDigest: string, bucket: number) =>
  `${loginLockPrefix}${email}:${ipDigest}:${bucket}`;
export async function isLoginLocked(
  email: string,
  ipDigest: string,
  limit: number,
  windowMs: number,
) {
  const key = loginLockKey(email, ipDigest, Math.floor(Date.now() / windowMs));
  const row = await getDb().securityThrottle.findUnique({
    where: { key },
    select: { count: true },
  });
  return !!row && row.count >= limit;
}
export async function recordLoginFailure(
  email: string,
  ipDigest: string,
  limit: number,
  windowMs: number,
) {
  const bucket = Math.floor(Date.now() / windowMs),
    key = loginLockKey(email, ipDigest, bucket);
  const rows = await getDb().$queryRaw<
    Array<{ count: number }>
  >`INSERT INTO "SecurityThrottle" (key,count,"expiresAt") VALUES (${key},1,${new Date((bucket + 1) * windowMs)}) ON CONFLICT (key) DO UPDATE SET count="SecurityThrottle".count+1 RETURNING count`;
  return rows[0].count >= limit;
}
export async function clearLoginLock(email: string, ipDigest?: string) {
  const prefix = loginLockPrefix + email + ":" + (ipDigest ? ipDigest + ":" : "");
  await getDb().securityThrottle.deleteMany({
    where: { key: { startsWith: prefix } },
  });
}
export function loginLockPrefixFor(email: string) {
  return loginLockPrefix + email + ":";
}
