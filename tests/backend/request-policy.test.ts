import test from "node:test";
import assert from "node:assert/strict";
import { parseConfig } from "../../src/server/config";
const config = parseConfig({
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://test@localhost/wapala_test",
  SECURITY_KEY: Buffer.alloc(32, 9).toString("base64"),
});
test("origin and pre-auth CSRF deny cross-origin, missing or expired tokens", async () => {
  const m = await import("../../src/server/security/csrf").catch(() => null);
  assert.ok(m);
  const request = (origin?: string) =>
    new Request("http://localhost:3000/api", {
      method: "POST",
      headers: origin ? { origin } : {},
    });
  assert.doesNotThrow(() => m.assertOrigin(request(config.appOrigin), config));
  for (const origin of [undefined, "null", "https://attacker.org"])
    assert.throws(() => m.assertOrigin(request(origin), config));
  const token = m.createPreAuthToken(config, new Date(0));
  assert.throws(() =>
    m.validatePreAuthToken(token, token, config, new Date(1000000)),
  );
  const current = m.createPreAuthToken(config);
  assert.doesNotThrow(() => m.validatePreAuthToken(current, current, config));
  assert.throws(() => m.validatePreAuthToken(current, "forged", config));
});
test("untrusted forwarded addresses cannot bypass IP throttles", async () => {
  const m = await import("../../src/server/security/request-context").catch(
    () => null,
  );
  assert.ok(m);
  const request = (ip: string) =>
    new Request("http://localhost", { headers: { "x-forwarded-for": ip } });
  assert.equal(
    m.requestContext(request("attacker"), config).ipDigest,
    m.requestContext(request("another"), config).ipDigest,
  );
  assert.notEqual(
    m.requestContext(request("127.0.0.1"), { ...config, trustProxy: true })
      .ipDigest,
    m.requestContext(request("127.0.0.2"), { ...config, trustProxy: true })
      .ipDigest,
  );
});
test("RBAC blocks cross-role writes and forced-change operational access", async () => {
  const m = await import("../../src/server/auth/policy").catch(() => null);
  assert.ok(m);
  const principal = {
    userId: "test",
    sessionId: "session",
    role: "POH" as const,
    mustChangePassword: false,
  };
  assert.doesNotThrow(() => m.requirePermission(principal, "members:write"));
  assert.throws(() => m.requirePermission(principal, "users:write"));
  assert.throws(() =>
    m.requirePermission(
      { ...principal, mustChangePassword: true },
      "members:read",
    ),
  );
  for (const role of ["SUPER_USER", "POH", "MULTIMEDIA", "INVENTARIS"] as const)
    assert.doesNotThrow(() =>
      m.requirePermission({ ...principal, role }, "recruitment:read"),
    );
  assert.throws(() =>
    m.requirePermission({ ...principal, role: "INVENTARIS" }, "members:write"),
  );
});
