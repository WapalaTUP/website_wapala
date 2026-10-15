import test from "node:test";
import assert from "node:assert/strict";
test("recovery CLI refuses password arguments and noninteractive input", async () => {
  const m = await import("../../scripts/terminal-password").catch(() => null);
  assert.ok(m);
  assert.throws(() => m.assertInteractive([], false));
  assert.throws(() => m.assertInteractive(["plaintext-password"], true));
  assert.doesNotThrow(() => m.assertInteractive([], true));
});
test("encrypted email payload cannot reveal reset token or accept modified ciphertext", async () => {
  const m = await import("../../src/server/email/encryption").catch(() => null);
  assert.ok(m);
  const key = Buffer.alloc(32, 8),
    text = "secret-reset-token";
  const encoded = m.encryptPayload(text, key);
  assert.ok(!encoded.includes(text));
  assert.equal(m.decryptPayload(encoded, key), text);
  const blob = Buffer.from(encoded, "base64");
  blob[blob.length - 1] ^= 1;
  assert.throws(() => m.decryptPayload(blob.toString("base64"), key));
});
