import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
test("operational XLSX retains literal identifiers and rejects oversized exports", async () => {
  const m = await import("../../src/server/domains/operational-export").catch(
    () => null,
  );
  assert.ok(m, "operational export implementation exists");
  const bytes = await m.operationalWorkbook(
    "Pendaftar",
    ["NIM", "Nama"],
    [["00123", "=1+1"]],
  );
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as Parameters<typeof wb.xlsx.load>[0]);
  assert.equal(wb.worksheets[0].getCell("A2").value, "00123");
  assert.equal(wb.worksheets[0].getCell("B2").value, "=1+1");
  assert.throws(
    () =>
      m.assertOperationalBudget(
        ["x"],
        Array.from({ length: 10001 }, () => ["x"]),
      ),
    { code: "EXPORT_LIMIT" },
  );
});
test("operational PDF writes full wrapped values and enforces page budget", async () => {
  const m = await import("../../src/server/domains/operational-export").catch(
    () => null,
  );
  assert.ok(m, "operational export implementation exists");
  const bytes = m.operationalPdf(
    "OR 2026",
    ["Kode", "Nama"],
    [["OR-01", "Calon anggota"]],
  );
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  assert.throws(
    () =>
      m.operationalPdf(
        "OR",
        ["Catatan"],
        Array.from({ length: 1000 }, () => ["x ".repeat(2000)]),
      ),
    { code: "EXPORT_LIMIT" },
  );
});
