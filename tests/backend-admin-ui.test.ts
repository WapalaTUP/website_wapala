import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
test("backend admin navigation reflects the actual role without a role-preview selector", async () => {
  const m = await import("../src/components/backend/admin-shell").catch(
    () => null,
  );
  assert.ok(m);
  const html = renderToStaticMarkup(
    createElement(
      m.BackendAdminShell,
      {
        role: "INVENTARIS",
        name: "Logistik",
        module: "inventaris",
        csrfToken: "csrf",
      },
      "Data nyata",
    ),
  );
  assert.ok(html.includes('href="/admin/inventaris"'));
  assert.ok(html.includes('href="/admin/or"'));
  assert.ok(!html.includes('href="/admin/kepengurusan"'));
  assert.ok(!html.includes('href="/admin/pengguna"'));
  assert.ok(!html.includes("Role preview"));
  assert.ok(html.includes("Data nyata"));
});
test("backend campaign empty state contains no fabricated campaign or donor records", async () => {
  const m = await import("../src/components/backend/campaigns").catch(
    () => null,
  );
  assert.ok(m);
  const html = renderToStaticMarkup(
    createElement(m.BackendCampaigns, {
      initialCampaigns: [],
      initialDonations: [],
      csrfToken: "csrf",
    }),
  );
  assert.ok(html.includes("Tambah kampanye"));
  assert.ok(html.includes("Belum ada kampanye"));
  assert.ok(!html.includes("Pengirim Contoh"));
});
test("backend member and OR tables render actual supplied records and annual periods", async () => {
  const records = await import("../src/components/backend/records").catch(
      () => null,
    ),
    recruitment = await import("../src/components/backend/recruitment").catch(
      () => null,
    );
  assert.ok(records);
  assert.ok(recruitment);
  const memberHtml = renderToStaticMarkup(
    createElement(records.BackendRecords, {
      kind: "anggota",
      initialRecords: [
        {
          id: "id1",
          version: 1,
          fields: { nama: "Anggota Database", nim: "00123", nia: "0001" },
          archived: false,
        },
      ],
      csrfToken: "csrf",
    }),
  );
  assert.ok(memberHtml.includes("Anggota Database"));
  assert.ok(memberHtml.includes("00123"));
  assert.ok(memberHtml.includes("Impor"));
  const orHtml = renderToStaticMarkup(
    createElement(recruitment.BackendRecruitment, {
      initialPeriods: [{ year: 2026, active: true, label: "Periode 2026" }],
      initialApplicants: [],
      initialYear: 2026,
      canWrite: false,
      csrfToken: "csrf",
    }),
  );
  assert.ok(orHtml.includes("Periode 2026"));
  assert.ok(!orHtml.includes("Gelombang"));
  assert.ok(!orHtml.includes("Buka periode tahunan"));
});
test("backend inventory editor renders actual stock without fabricating sample equipment", async () => {
  const m = await import("../src/components/backend/inventory").catch(() => null); assert.ok(m);
  const html = renderToStaticMarkup(createElement(m.BackendInventory, { initialEquipment: [{ id: "12345678-1234-4234-8234-123456789012", version: 1, code: "00001", name: "Alat Database", category: "Gunung Hutan", brand: "", typeColor: "", source: "", yearEntered: "", photo: "", total: 2, fit: 1, condition: "Baik", location: "Sekretariat", available: false, maxDays: 7, maxQuantity: 1, notes: "", archived: false }], csrfToken: "csrf" }));
  assert.ok(html.includes("00001")); assert.ok(html.includes("Alat Database")); assert.ok(html.includes("Impor"));
});
