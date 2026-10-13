import { test } from "node:test";
import assert from "node:assert/strict";
import { annualPeriod, migrateAnnualPeriods } from "../src/lib/periods";
import { seed } from "./fixtures/seed";
test("annual labels contain only the year and reject wave names for a new period", () => {
  assert.equal(annualPeriod("2024"), "Periode 2024");
  assert.equal(annualPeriod("2025"), "Periode 2025");
  assert.equal(annualPeriod("2025 gelombang 2"), null);
});
test("old wave periods collapse to one year without dropping applicant records", () => {
  const state = {
    ...seed,
    settings: {
      ...seed.settings,
      period: "2026 — Gelombang 1",
      periods: [
        "2026 — Gelombang 1",
        "2026 — Gelombang 2",
        "2025 — Gelombang 1",
      ],
    },
    applicants: [{ ...seed.applicants[0], period: "2026 — Gelombang 2" }],
  };
  const migrated = migrateAnnualPeriods(state);
  assert.deepEqual(migrated.settings.periods, ["Periode 2026", "Periode 2025"]);
  assert.equal(migrated.settings.period, "Periode 2026");
  assert.equal(migrated.applicants.length, 1);
  assert.equal(migrated.applicants[0].period, "Periode 2026");
  assert.equal(migrated.applicants[0].code, state.applicants[0].code);
});
