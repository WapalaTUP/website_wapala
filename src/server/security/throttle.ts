import "server-only";
import { getDb } from "../db";
import { getConfig } from "../config";
import { DomainError } from "../errors";
import { hmacToken } from "./tokens";
export async function takeThrottle(
  key: string,
  limit: number,
  windowMs: number,
) {
  const bucket = Math.floor(Date.now() / windowMs),
    id = hmacToken("throttle:" + key + ":" + bucket, getConfig().securityKey),
    expiresAt = new Date((bucket + 1) * windowMs);
  const rows = await getDb().$queryRaw<
    Array<{ count: number }>
  >`INSERT INTO "SecurityThrottle" (key,count,"expiresAt") VALUES (${id},1,${expiresAt}) ON CONFLICT (key) DO UPDATE SET count="SecurityThrottle".count+1 RETURNING count`;
  if (rows[0].count > limit)
    throw new DomainError(
      "RATE_LIMIT",
      429,
      "Terlalu banyak percobaan. Coba kembali nanti.",
    );
}
