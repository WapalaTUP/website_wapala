import test from "node:test";
import assert from "node:assert/strict";
import { seed } from "./fixtures/seed";

test("campaign totals isolate verified non-archived confirmations", async () => {
  const m = await import("../src/lib/campaigns").catch(() => null);
  assert.ok(m, "Campaign domain is not implemented");
  const rows = [
    { ...seed.donations[0], campaignId: "a", amount: 100 },
    { ...seed.donations[0], campaignId: "b", amount: 200 },
    {
      ...seed.donations[0],
      campaignId: "a",
      amount: 300,
      status: "Menunggu" as const,
    },
    { ...seed.donations[0], campaignId: "a", amount: 400, archived: true },
  ];
  assert.equal(m.campaignTotal(rows, "a"), 100);
});
test("legacy migration preserves records and links donations exactly once", async () => {
  const m = await import("../src/lib/preview-migration").catch(() => null);
  assert.ok(m, "Preview migration is not implemented");
  const old = structuredClone(seed);
  delete (old as Partial<typeof old>).campaigns;
  old.donations.forEach((d) => delete (d as Partial<typeof d>).campaignId);
  old.settings.donationActive = true;
  const next = m.migratePreviewState(old);
  assert.equal(next.campaigns[0].status, "active");
  assert.ok(next.donations.every((d) => d.campaignId === "legacy-campaign"));
  assert.deepEqual(next.loans, old.loans);
  assert.deepEqual(next.audit, old.audit);
  assert.deepEqual(m.migratePreviewState(next), next);
});
test("closed campaigns cannot accept a confirmation from a stale form", async () => {
  const m = await import("../src/lib/campaigns").catch(() => null);
  assert.ok(m, "Campaign domain is not implemented");
  const s = structuredClone(seed);
  s.campaigns[0].status = "active";
  assert.equal(m.canConfirmDonation(s, s.campaigns[0].id), true);
  s.campaigns[0].status = "closed";
  assert.equal(m.canConfirmDonation(s, s.campaigns[0].id), false);
  assert.equal(m.activeCampaigns(s).length, 0);
});
test("campaign validation rejects invalid targets and reversed dates", async () => {
  const m = await import("../src/lib/campaigns").catch(() => null);
  assert.ok(m);
  const c = { ...seed.campaigns[0] };
  assert.ok(m.validateCampaign({ ...c, target: NaN }));
  assert.ok(
    m.validateCampaign({ ...c, start: "2026-12-31", end: "2026-01-01" }),
  );
  assert.equal(m.validateCampaign(c), "");
});
test("campaigns preserve multiple bank accounts and validate each recipient name", async () => {
  const m = await import("../src/lib/campaigns");
  assert.equal(typeof m.getBankAccounts, "function");
  const c = {
    ...seed.campaigns[0],
    bankAccounts: [
      {
        id: "b1",
        bank: "Bank A (contoh)",
        number: "000123",
        holder: "Penerima A",
      },
      {
        id: "b2",
        bank: "Bank B (contoh)",
        number: "000456",
        holder: "Penerima B",
      },
    ],
    poster: "/images/poster-contoh.png",
  };
  assert.deepEqual(
    m.getBankAccounts(c).map((b) => b.number),
    ["000123", "000456"],
  );
  assert.equal(m.validateCampaign(c), "");
  assert.ok(
    m.validateCampaign({
      ...c,
      bankAccounts: [{ ...c.bankAccounts[0], holder: "" }],
    }),
  );
});
test("legacy bank migration retains the number without inventing an account holder", async () => {
  const { migratePreviewState } = await import("../src/lib/preview-migration");
  const old = structuredClone(seed);
  Object.assign(old.campaigns[0], { bank: "Bank Contoh", account: "0000123" });
  delete (old.campaigns[0] as Partial<(typeof old.campaigns)[0]>).bankAccounts;
  delete (old.campaigns[0] as Partial<(typeof old.campaigns)[0]>).poster;
  const next = migratePreviewState(old);
  const banks = next.campaigns[0].bankAccounts;
  assert.ok(banks);
  assert.equal(banks[0].number, "0000123");
  assert.equal(banks[0].holder, "");
  assert.equal(next.campaigns[0].poster, "");
  assert.deepEqual(migratePreviewState(next), next);
});
