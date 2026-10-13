import {
  createHash,
  randomBytes,
  timingSafeEqual,
  createHmac,
} from "node:crypto";
export const newToken = () => randomBytes(32).toString("base64url");
export const digestToken = (raw: string) =>
  createHash("sha256").update(raw).digest("hex");
export function constantEqual(a: string, b: string) {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export const hmacToken = (value: string, key: Buffer) =>
  createHmac("sha256", key).update(value).digest("base64url");
