import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { applicantPdfTable } from "../../src/server/domains/applicant-pdf";
test("OR PDF embeds each applicant photo and retains complete field values in tables", async () => {
  const bytes = await sharp({
    create: { width: 30, height: 40, channels: 3, background: "green" },
  })
    .png()
    .toBuffer();
  const pdf = applicantPdfTable(2026, [
    {
      code: "OR-001",
      time: "2026-10-14T00:00:00Z",
      fields: {
        nama: "Peserta uji",
        nim: "00123",
        motivasi: "Belajar ".repeat(400) + "AKHIR",
      },
      photoData: "data:image/png;base64," + bytes.toString("base64"),
    },
  ]);
  const source = pdf.toString("latin1");
  assert.match(source, /\/Subtype \/Image/);
  assert.match(source, /Data pendaftar/);
  assert.match(source, /00123/);
  assert.match(source, /AKHIR/);
  assert.doesNotMatch(source, /Foto tidak tersedia/);
});
test("missing OR photo does not remove an applicant and oversized exports are refused", () => {
  const row = {
    code: "OR-002",
    time: "2026-10-14T00:00:00Z",
    fields: { nama: "Tanpa foto" },
  };
  assert.match(
    applicantPdfTable(2026, [row]).toString("latin1"),
    /Foto tidak tersedia/,
  );
  assert.throws(
    () =>
      applicantPdfTable(
        2026,
        Array.from({ length: 201 }, () => row),
      ),
    { code: "EXPORT_LIMIT" },
  );
});
