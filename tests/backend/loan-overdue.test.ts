import test from "node:test";
import assert from "node:assert/strict";
test("overdue day boundary uses Jakarta midnight and excludes due-today loans", async () => {
  const m = await import("../../src/server/domains/loan-overdue").catch(
    () => null,
  );
  assert.ok(m, "overdue job exists");
  assert.equal(
    m.overdueCutoff(new Date("2026-10-14T16:59:59Z")).toISOString(),
    "2026-10-14T00:00:00.000Z",
  );
  assert.equal(
    m.overdueCutoff(new Date("2026-10-14T17:00:00Z")).toISOString(),
    "2026-10-15T00:00:00.000Z",
  );
});
