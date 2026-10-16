import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getConfig } from "../config";
import { constantEqual, hmacToken } from "./tokens";
import { DomainError } from "../errors";
const payloadSchema = z
  .object({
    eventId: z.uuid(),
    revisionId: z.uuid(),
    ownerDigest: z.string().min(20).max(100),
    expiresAt: z.number().int().positive(),
  })
  .strict();
type Options = { key?: Buffer; now?: number };
export function issueEventFormToken(eventId: string, revisionId: string, options: Options = {}) {
  const key = options.key ?? getConfig().securityKey;
  const payload = payloadSchema.parse({
    eventId,
    revisionId,
    ownerDigest: hmacToken("event-owner:" + randomUUID(), key),
    expiresAt: (options.now ?? Date.now()) + 7200000,
  });
  const value = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return value + "." + hmacToken("event-form:" + value, key);
}
export function verifyEventFormToken(token: string, options: Options = {}) {
  return verifyToken(token, options, false);
}
export function verifyEventReplayToken(token: string, options: Options = {}) {
  return verifyToken(token, options, true);
}
function verifyToken(token: string, options: Options, replay: boolean) {
  const fail = () => {
    throw new DomainError(
      "EVENT_TOKEN_EXPIRED",
      403,
      "Sesi formulir tidak valid atau kedaluwarsa. Muat ulang formulir.",
    );
  };
  if (!token || token.length > 1500) return fail();
  const [data, signature, ...extra] = token.split(".");
  if (
    extra.length ||
    !signature ||
    !constantEqual(
      signature,
      hmacToken("event-form:" + data, options.key ?? getConfig().securityKey),
    )
  )
    return fail();
  try {
    const v = payloadSchema.parse(JSON.parse(Buffer.from(data, "base64url").toString()));
    if (
      v.expiresAt + (replay ? 86400000 : 0) <= (options.now ?? Date.now()) ||
      v.expiresAt > (options.now ?? Date.now()) + 7200000
    )
      return fail();
    return v;
  } catch {
    return fail();
  }
}
