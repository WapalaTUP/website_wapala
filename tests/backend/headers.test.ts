import test from "node:test";
import assert from "node:assert/strict";
test("production CSP permits only nonced scripts and denies object/embed execution", async () => {
  const m = await import("../../src/server/security/headers").catch(() => null);
  assert.ok(m);
  const csp = m.contentSecurityPolicy("unpredictableNonce", true);
  const scripts = csp
    .split(";")
    .find((v) => v.trim().startsWith("script-src"))!;
  assert.ok(scripts.includes("'nonce-unpredictableNonce'"));
  assert.ok(!scripts.includes("unsafe-inline"));
  assert.ok(!scripts.includes("unsafe-eval"));
  assert.ok(csp.includes("object-src 'none'"));
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.ok(m.contentSecurityPolicy("nonce", false).includes("unsafe-eval"));
});
