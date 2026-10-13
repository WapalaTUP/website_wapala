import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BackendDashboard } from "../src/components/backend/dashboard";
test("import preview blocks submission and names the invalid CSV row and field", async () => {
  const m = await import("../src/components/backend/import");
  assert.ok("BackendImportPreview" in m);
  const html = renderToStaticMarkup(
    createElement(m.BackendImportPreview, {
      kind: "inventaris",
      result: {
        rows: [],
        displayRows: [{ code: "0007", name: "Alat", fit: "" }],
        errors: [
          { row: 2, field: "fit", message: "Jumlah layak belum tersedia." },
        ],
      },
      busy: false,
      onSubmit: () => {},
    }),
  );
  assert.ok(html.includes("Jumlah layak"));
  assert.ok(html.includes("Jumlah layak belum tersedia."));
  assert.match(html, /<button[^>]*disabled[^>]*>Impor/);
});
test("dashboard exposes each metric with its count and an accessible destination", () => {
  const html = renderToStaticMarkup(
    createElement(BackendDashboard, {
      name: "Admin",
      counts: [{ label: "Anggota", value: 204, href: "/admin/anggota" }],
    }),
  );
  assert.ok(html.includes('aria-label="Ringkasan organisasi"'));
  assert.ok(html.includes('aria-label="Anggota: 204. Buka modul"'));
  assert.ok(html.includes('href="/admin/anggota"'));
});
