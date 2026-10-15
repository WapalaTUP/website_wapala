import test from "node:test";
import assert from "node:assert/strict";
test("archive restoration refuses stale archive timestamps and active loan obligations", async () => {
  const m = await import("../../src/server/domains/archives");
  const guard = (
    m as unknown as {
      assertArchiveRestore: (
        at: Date | null,
        expected: string,
        loan?: {
          status: string;
          penaltyStatus: string;
          collateralStatus: string;
        },
      ) => void;
    }
  ).assertArchiveRestore;
  assert.equal(typeof guard, "function", "restoration guard exists");
  const at = new Date("2026-01-01T00:00:00Z");
  assert.doesNotThrow(() => guard(at, at.toISOString()));
  assert.throws(() => guard(null, at.toISOString()), { code: "CONFLICT" });
  assert.throws(() => guard(at, "2026-01-02T00:00:00.000Z"), {
    code: "CONFLICT",
  });
  assert.throws(
    () =>
      guard(at, at.toISOString(), {
        status: "borrowed",
        penaltyStatus: "unpaid",
        collateralStatus: "held",
      }),
    { code: "ACTIVE_OBLIGATION" },
  );
  assert.doesNotThrow(() =>
    guard(at, at.toISOString(), {
      status: "rejected",
      penaltyStatus: "none",
      collateralStatus: "pending",
    }),
  );
  assert.throws(
    () =>
      guard(at, at.toISOString(), {
        status: "returned",
        penaltyStatus: "pending",
        collateralStatus: "returned",
      }),
    { code: "ACTIVE_OBLIGATION" },
  );
  assert.throws(
    () =>
      guard(at, at.toISOString(), {
        status: "returned",
        penaltyStatus: "paid",
        collateralStatus: "held",
      }),
    { code: "ACTIVE_OBLIGATION" },
  );
});
