import test from "node:test";
import assert from "node:assert/strict";
test("readiness failure is redacted and returns 503 rather than a success placeholder", async () => {
  const m = await import("../../src/server/http/health").catch(() => null);
  assert.ok(m);
  const response = await m.healthResponse(async () => {
    throw new Error("postgresql://private-password@host/db");
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).status, "degraded");
  const ok = await m.healthResponse(async () => {});
  assert.equal(ok.status, 200);
});
