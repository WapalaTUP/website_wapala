import test from "node:test";
import assert from "node:assert/strict";
import { seed } from "./fixtures/seed";
import type { LoanStatus } from "../src/lib/types";
async function domain() {
  const m = await import("../src/lib/management").catch(() => null);
  assert.ok(m, "Management domain is not implemented");
  return m;
}
test("rollover archives only returned/rejected loans and preserves active obligations", async () => {
  const m = await domain();
  const s = structuredClone(seed);
  const statuses: LoanStatus[] = [
    "Diajukan",
    "Ditolak",
    "Disetujui",
    "Dipinjam",
    "Menunggu Verifikasi Pengembalian",
    "Terlambat",
    "Dikembalikan",
  ];
  s.loans = statuses.map((status, i) => ({
    ...structuredClone(seed.loans[0]),
    id: String(i),
    status,
    originPeriod: "2025",
    managementPeriod: "2026",
  }));
  const before = structuredClone(s);
  m.applyRollover(s, "2027", {}, "Super User");
  for (let i = 0; i < statuses.length; i++) {
    assert.equal(
      Boolean(s.loans[i].archived),
      ["Ditolak", "Dikembalikan"].includes(statuses[i]),
    );
    assert.equal(s.loans[i].originPeriod, "2025");
    assert.deepEqual(s.loans[i].history, before.loans[i].history);
    assert.deepEqual(s.loans[i].items, before.loans[i].items);
    assert.equal(s.loans[i].status, statuses[i]);
  }
  assert.deepEqual(s.equipment, before.equipment);
  assert.deepEqual(s.applicants, before.applicants);
  assert.equal(s.settings.period, before.settings.period);
  assert.throws(() => m.applyRollover(s, "2027", {}, "Super User"));
});
test("reset is Super User only and excludes Super User from bulk reset choices", async () => {
  const m = await domain();
  const s = structuredClone(seed);
  s.records.pengguna.push({
    id: "su",
    fields: { role: "Super User", nama: "Super", email: "owner@example.com" },
  });
  assert.throws(() => m.applyRollover(s, "2027", {}, "POH"));
  assert.throws(() => m.applyRollover(s, "invalid", {}, "Super User"));
  m.applyRollover(
    s,
    "2027",
    { "usr-1": "request-new", su: "request-new" },
    "Super User",
  );
  assert.equal(
    s.records.pengguna.find((u) => u.id === "usr-1")?.fields.resetRequired,
    "Ya",
  );
  assert.equal(
    s.records.pengguna.find((u) => u.id === "su")?.fields.resetRequired,
    undefined,
  );
  assert.equal(
    s.records.pengguna.find((u) => u.id === "usr-2")?.fields.resetRequired,
    undefined,
  );
});
test("account migration updates seed identities but preserves custom accounts", async () => {
  const m = await import("../src/lib/preview-migration");
  const s = structuredClone(seed);
  s.records.pengguna[0].fields.email = "poh@example.com";
  s.records.pengguna[1].fields.email = "custom@example.com";
  const next = m.migratePreviewState(s);
  assert.equal(next.records.pengguna[0].fields.email, "POH@wapala.org");
  assert.equal(next.records.pengguna[1].fields.email, "custom@example.com");
  assert.deepEqual(m.migratePreviewState(next), next);
});
