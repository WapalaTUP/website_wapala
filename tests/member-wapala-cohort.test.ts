import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareBackendImport } from "../src/lib/backend-import";
import { importFields, normalizeImportHeader, parseCsv } from "../src/lib/import-data";
import { legacyMemberFields, mergedMemberFields } from "../src/lib/member-fields";
import { memberFields } from "../src/lib/operational-schema";

const csv =
  "nomor,nama,nim,prodi,angkatan,jenis_kelamin,nia,status,kontak,foto,angkatan_wapala\n1,Anggota Contoh,NIM-001,Informatika,2024,Laki-laki,WPL.TEST.001,AB,,,WAPALA XX";
function prepare(source: string) {
  const table = parseCsv(source);
  const mapping = Object.fromEntries(
    importFields.anggota.map((key) => [
      key,
      table.headers.find(
        (header) => normalizeImportHeader(header) === normalizeImportHeader(key),
      ) || "",
    ]),
  );
  return prepareBackendImport("anggota", table, mapping);
}

test("CSV maps academic year and WAPALA cohort independently, including its original last-column order", () => {
  const result = prepare(csv);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].angkatan, "2024");
  assert.equal(result.rows[0].angkatan_wapala, "WAPALA XX");
  assert.equal(result.displayRows[0].angkatan_wapala, "WAPALA XX");
});

test("older member CSVs without the optional WAPALA cohort remain accepted", () => {
  const result = prepare(csv.replace(",angkatan_wapala", "").replace(",WAPALA XX", ""));
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0].angkatan_wapala, "");
  assert.equal(result.rows[0].angkatan, "2024");
});

test("new member metadata stays outside legacy strict JSON and survives read/export projection", () => {
  const input = prepare(csv).rows[0];
  const fields = legacyMemberFields(input);
  const oldSchema = memberFields.omit({ angkatan_wapala: true }).strict();
  assert.equal(oldSchema.safeParse(fields).success, true);
  assert.equal(Object.hasOwn(fields, "angkatan_wapala"), false);
  const result = mergedMemberFields({ fields, angkatanWapala: "WAPALA XX" });
  assert.equal(result.angkatan, "2024");
  assert.equal(result.angkatan_wapala, "WAPALA XX");
});

test("old member rows and correction payloads remain readable with an empty cohort", () => {
  const fields = legacyMemberFields(prepare(csv).rows[0]);
  assert.equal(memberFields.parse(fields).angkatan_wapala, "");
  const correction = legacyMemberFields({ ...fields, prodi: "Teknik Informatika" });
  assert.equal(
    mergedMemberFields({ fields: correction, angkatanWapala: "WAPALA XX" }).angkatan_wapala,
    "WAPALA XX",
  );
});
