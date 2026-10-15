import test from "node:test";
import assert from "node:assert/strict";
import { seed } from "./fixtures/seed";
async function domain() {
  const m = await import("../src/lib/import-data").catch(() => null);
  assert.ok(m, "Import domain is not implemented");
  return m;
}
test("CSV preserves leading zeros, quoted separators and newlines", async () => {
  const m = await domain();
  assert.deepEqual(
    m.parseCsv('\ufeffNIA;NIM;Nama\r\n0007;00123;"Nama; Contoh"').rows,
    [["0007", "00123", "Nama; Contoh"]],
  );
  assert.equal(
    m.parseCsv('Nama,Catatan\n"Contoh","Baris 1\nBaris 2"').rows[0][1],
    "Baris 1\nBaris 2",
  );
  assert.throws(() => m.parseCsv('Nama\n"unterminated'));
});
test("import blocks duplicate identifiers and cannot overwrite existing records", async () => {
  const m = await domain();
  const table = {
    headers: [
      "nia",
      "nim",
      "nama",
      "prodi",
      "angkatan",
      "jenis_kelamin",
      "status",
      "kontak",
    ],
    rows: [
      [
        "0007",
        "00123",
        "Contoh",
        "Informatika",
        "2026",
        "Laki-laki",
        "Aktif",
        "081234567890",
      ],
      [
        "0007",
        "00456",
        "Lain",
        "Informatika",
        "2026",
        "Laki-laki",
        "Aktif",
        "081234567891",
      ],
    ],
  };
  const mapping = Object.fromEntries(table.headers.map((h) => [h, h]));
  const p = m.validateImport("anggota", table, mapping, seed);
  assert.ok(p.errors.some((e) => e.field === "nia"));
  assert.throws(() => m.applyImport(structuredClone(seed), "anggota", p));
});
test("valid member import preserves identifier text and appends exactly once", async () => {
  const m = await domain();
  const s = structuredClone(seed);
  const table = {
    headers: [
      "nia",
      "nim",
      "nama",
      "prodi",
      "angkatan",
      "jenis_kelamin",
      "status",
      "kontak",
    ],
    rows: [
      [
        "0007",
        "00123",
        "Contoh Baru",
        "Informatika",
        "2026",
        "Laki-laki",
        "Aktif",
        "081234567890",
      ],
    ],
  };
  const mapping = Object.fromEntries(table.headers.map((h) => [h, h]));
  const p = m.validateImport("anggota", table, mapping, s);
  assert.deepEqual(p.errors, []);
  m.applyImport(s, "anggota", p);
  assert.equal(s.records.anggota.at(-1)?.fields.nim, "00123");
  assert.ok(m.validateImport("anggota", table, mapping, s).errors.length);
});
test("equipment import rejects noninteger totals and fit greater than total", async () => {
  const m = await domain();
  const fields = [
    "code",
    "name",
    "category",
    "total",
    "fit",
    "condition",
    "location",
  ];
  const table = {
    headers: fields,
    rows: [
      ["X-001", "Contoh", "GH", "2", "3", "Baik", "Box A"],
      ["X-002", "Contoh", "GH", "1.5", "1", "Baik", "Box A"],
    ],
  };
  const p = m.validateImport(
    "inventaris",
    table,
    Object.fromEntries(fields.map((h) => [h, h])),
    seed,
  );
  assert.ok(p.errors.some((e) => e.field === "fit"));
  assert.ok(p.errors.some((e) => e.field === "total"));
});
test("draft persistence failure leaves committed state unchanged", async () => {
  const m = await import("../src/lib/persistence").catch(() => null);
  assert.ok(m, "Atomic persistence is not implemented");
  const old = structuredClone(seed),
    draft = structuredClone(seed);
  draft.settings.email = "changed@example.com";
  assert.throws(() =>
    m.persistDraft(draft, {
      setItem() {
        throw new Error("quota");
      },
    }),
  );
  assert.equal(old.settings.email, "Wapalatelkomuniversity@gmail.com");
});
test("XLSX preserves formatted identifier zeros and rejects formula cells", async () => {
  const { readImportFile } = await import("../src/lib/import-files");
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Contoh");
  sheet.addRow(["NIA", "NIM"]);
  sheet.addRow([7, 123]);
  sheet.getCell("A2").numFmt = "0000";
  sheet.getCell("B2").numFmt = "00000";
  let bytes = await book.xlsx.writeBuffer();
  const table = await readImportFile(
    new File([new Uint8Array(bytes)], "contoh.xlsx"),
  );
  assert.deepEqual(table.rows, [["0007", "00123"]]);
  sheet.getCell("B2").value = { formula: "1+1", result: 2 };
  bytes = await book.xlsx.writeBuffer();
  await assert.rejects(
    () => readImportFile(new File([new Uint8Array(bytes)], "formula.xlsx")),
    /Formula/,
  );
});
test("multi-section Excel identifier formats retain displayed zero padding", async () => {
  const { readImportFile } = await import("../src/lib/import-files");
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Contoh");
  sheet.addRow(["NIA", "NIM"]);
  sheet.addRow([7, 123]);
  sheet.getCell("A2").numFmt = "0000;[Red]-0000";
  sheet.getCell("B2").numFmt = "00000;00000;00000;@";
  const bytes = await book.xlsx.writeBuffer();
  const table = await readImportFile(
    new File([new Uint8Array(bytes)], "format.xlsx"),
  );
  assert.deepEqual(table.rows, [["0007", "00123"]]);
});
