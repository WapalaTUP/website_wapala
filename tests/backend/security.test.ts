import test from "node:test";
import assert from "node:assert/strict";
test("production CSP limits frames and scripts without a third-party verification provider", async () => {
  const { contentSecurityPolicy } =
    await import("../../src/server/security/headers");
  const policy = contentSecurityPolicy("testnonce", true);
  assert.doesNotMatch(policy, /cloudflare|turnstile/i);
  assert.match(policy, /script-src[^;]*'nonce-testnonce'[^;]*'strict-dynamic'/);
  assert.doesNotMatch(policy, /unsafe-eval|script-src[^;]*unsafe-inline/);
});
test("random access tokens are unique and their stored digest is not the secret", async () => {
  const m = await import("../../src/server/security/tokens").catch(() => null);
  assert.ok(m);
  const tokens = Array.from({ length: 100 }, () => m.newToken());
  assert.equal(new Set(tokens).size, 100);
  assert.ok(tokens.every((t) => /^[A-Za-z0-9_-]{43}$/.test(t)));
  assert.notEqual(m.digestToken(tokens[0]), tokens[0]);
  assert.equal(m.digestToken(tokens[0]).length, 64);
});
test("password hashing enforces passphrase length and byte cap before Argon2id", async () => {
  const m = await import("../../src/server/security/password").catch(
    () => null,
  );
  assert.ok(m);
  assert.throws(() => m.validatePassword("12345678901"));
  assert.throws(() => m.validatePassword("a".repeat(1025)));
  const hash = await m.hashPassword("test-only-long-passphrase");
  assert.match(hash, /^\$argon2id\$/);
  assert.equal(await m.verifyPassword(hash, "test-only-long-passphrase"), true);
  assert.equal(await m.verifyPassword(hash, "different-passphrase"), false);
});
test("body boundary rejects spoofed fields, malformed JSON and streaming overflow", async () => {
  const m = await import("../../src/server/http/body").catch(() => null);
  assert.ok(m);
  const { z } = await import("zod");
  const schema = z.object({ name: z.string() }).strict();
  const request = (body: string) =>
    new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
  assert.deepEqual(await m.readJson(request('{"name":"valid"}'), schema), {
    name: "valid",
  });
  await assert.rejects(
    m.readJson(request('{"name":"valid","role":"SUPER_USER"}'), schema),
  );
  await assert.rejects(m.readJson(request("not-json"), schema));
  await assert.rejects(
    m.readJson(request('{"name":"' + "a".repeat(100) + '"}'), schema, 20),
  );
});
