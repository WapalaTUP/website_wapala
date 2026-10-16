import argon2 from "argon2";
import { DomainError } from "../errors";
let active = 0;
const waiters: Array<() => void> = [];
async function bounded<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 2) {
    if (waiters.length >= 8) throw new DomainError("BUSY", 429);
    await new Promise<void>((resolve) => waiters.push(resolve));
  } else active++;
  try {
    return await fn();
  } finally {
    const next = waiters.shift();
    if (next) next();
    else active--;
  }
}
export function validatePassword(value: string) {
  if (
    typeof value !== "string" ||
    Array.from(value).length < 12 ||
    Buffer.byteLength(value, "utf8") > 1024
  )
    throw new DomainError(
      "PASSWORD_INVALID",
      400,
      "Password minimal 12 karakter dan maksimal 1024 byte.",
    );
}
export async function hashPassword(value: string) {
  validatePassword(value);
  return bounded(() =>
    argon2.hash(value, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    }),
  );
}
export async function verifyPassword(hash: string, value: string) {
  if (typeof value !== "string" || Buffer.byteLength(value) > 1024) return false;
  return bounded(() => argon2.verify(hash, value).catch(() => false));
}
let dummy: Promise<string> | undefined;
export function dummyHash() {
  return (dummy ??= hashPassword("dummy-invalid-login-passphrase"));
}
