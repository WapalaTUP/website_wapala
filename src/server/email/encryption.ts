import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
const envelopeKey = (key: Buffer) => createHmac("sha256", key).update("wapala-email-v1").digest();
export function encryptPayload(text: string, key: Buffer) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", envelopeKey(key), iv);
  cipher.setAAD(Buffer.from("wapala-email-v1"));
  const bytes = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64");
}
export function decryptPayload(encoded: string, key: Buffer) {
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length < 29) throw new Error("Invalid encrypted envelope");
  const decipher = createDecipheriv("aes-256-gcm", envelopeKey(key), bytes.subarray(0, 12));
  decipher.setAAD(Buffer.from("wapala-email-v1"));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
}
