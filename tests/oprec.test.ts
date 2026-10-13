import { test } from "node:test";
import assert from "node:assert/strict";
import { applicantExportRow } from "../src/lib/recruitment-fields";
import { seed } from "./fixtures/seed";
test("Oprec export keeps legacy column labels and combines birth place and date", () => {
  const row = applicantExportRow(
    {
      ...seed.applicants[0],
      fields: {
        nama: "Nama Contoh",
        tempat_lahir: "Banyumas",
        tanggal_lahir: "2005-01-12",
        telepon: "081234567890",
        telepon_orangtua: "081234567891",
        nama_orangtua: "Wali Contoh",
      },
    },
    0,
  );
  assert.equal(row["No"], 1);
  assert.equal(row["Nama Lengkap"], "Nama Contoh");
  assert.equal(row["Tempat Tanggal Lahir"], "Banyumas, 12 Januari 2005");
  assert.equal(row["No Handphone"], "081234567890");
  assert.equal(row["No Handphone Orang Tua"], "081234567891");
  assert.equal(row["Nama Orang Tua"], "Wali Contoh");
});
