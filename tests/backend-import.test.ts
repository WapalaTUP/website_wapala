import test from "node:test";
import assert from "node:assert/strict";
const service = () => import("../src/lib/backend-import").catch(() => null);
test("coarse inventory damage requires an explicit physical return condition", async () => {
  const m = await import("../src/lib/operational-schema");
  assert.ok("initialReturnCondition" in m);
  assert.equal(m.initialReturnCondition("Sebagian rusak"), "");
  assert.equal(m.initialReturnCondition("Rusak"), "");
  assert.equal(m.initialReturnCondition("Baik"), "Baik");
});
test("CSV spreadsheet year strings normalize only zero-decimal years", async () => {
  const m = await service();
  assert.ok(m);
  const headers = [
    "code",
    "name",
    "category",
    "total",
    "fit",
    "condition",
    "location",
    "yearEntered",
  ];
  const mapping = Object.fromEntries(headers.map((h) => [h, h]));
  const base = ["0007", "Alat", "Camp", "2", "1", "Baik", "Gudang"];
  const good = m.prepareBackendImport(
    "inventaris",
    { headers, rows: [[...base, "2023.0"]] },
    mapping,
  );
  assert.deepEqual(good.errors, []);
  assert.equal(good.rows[0].yearEntered, "2023");
  const bad = m.prepareBackendImport(
    "inventaris",
    { headers, rows: [[...base, "2023.5"]] },
    mapping,
  );
  assert.ok(bad.errors.some((e) => e.field === "yearEntered"));
});
test("legacy inventory conditions remain exact rather than inventing damage severity", async () => {
  const m = await service();
  assert.ok(m);
  const headers = [
    "code",
    "name",
    "category",
    "total",
    "fit",
    "condition",
    "location",
  ];
  for (const condition of ["Rusak", "Sebagian rusak"]) {
    const result = m.prepareBackendImport(
      "inventaris",
      {
        headers,
        rows: [["0007", "Alat", "Camp", "2", "1", condition, "Gudang"]],
      },
      Object.fromEntries(headers.map((h) => [h, h])),
    );
    assert.deepEqual(result.errors, []);
    assert.equal(result.rows[0].condition, condition);
  }
});
test("historical member data keeps unavailable NIM and contact empty rather than inventing values", async () => {
  const m = await service();
  assert.ok(m);
  const headers = [
    "nama",
    "nim",
    "prodi",
    "angkatan",
    "jenis_kelamin",
    "nia",
    "status",
    "kontak",
  ];
  const result = m.prepareBackendImport(
    "anggota",
    {
      headers,
      rows: [
        ["Anggota Uji", "", "Teknik", "2025", "Laki-laki", "00007", "ALB", ""],
      ],
    },
    Object.fromEntries(headers.map((h) => [h, h])),
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0].nim, "");
  assert.equal(result.rows[0].kontak, "");
});
test("member preview retains actual AB and AM membership codes", async () => {
  const m = await service();
  assert.ok(m);
  const headers = [
    "nama",
    "nim",
    "prodi",
    "angkatan",
    "jenis_kelamin",
    "nia",
    "status",
    "kontak",
  ];
  for (const status of ["AB", "AM"]) {
    const result = m.prepareBackendImport(
      "anggota",
      {
        headers,
        rows: [
          [
            "Anggota Uji",
            "00123",
            "Teknik",
            "2025",
            "Laki-laki",
            "00007",
            status,
            "081234567890",
          ],
        ],
      },
      Object.fromEntries(headers.map((h) => [h, h])),
    );
    assert.deepEqual(result.errors, []);
    assert.equal(result.rows[0].status, status);
  }
});
test("inventory preview rejects blank numeric stock instead of silently converting it to zero", async () => {
  const m = await service();
  assert.ok(m);
  const headers = [
    "code",
    "name",
    "category",
    "total",
    "fit",
    "condition",
    "location",
  ];
  const result = m.prepareBackendImport(
    "inventaris",
    { headers, rows: [["0007", "Alat", "Camp", "2", "", "Baik", "Gudang"]] },
    Object.fromEntries(headers.map((h) => [h, h])),
  );
  assert.ok(result.errors.some((e) => e.row === 2 && e.field === "fit"));
  assert.equal(result.rows.length, 0);
});
test("preview reports duplicate source identifiers by CSV row without dropping records", async () => {
  const m = await service();
  assert.ok(m);
  const headers = [
    "code",
    "name",
    "category",
    "total",
    "fit",
    "condition",
    "location",
  ];
  const result = m.prepareBackendImport(
    "inventaris",
    {
      headers,
      rows: [
        ["0007", "Alat A", "Camp", "2", "1", "Baik", "Gudang"],
        ["0007", "Alat B", "Camp", "2", "1", "Baik", "Gudang"],
      ],
    },
    Object.fromEntries(headers.map((h) => [h, h])),
  );
  assert.ok(result.errors.some((e) => e.row === 3 && e.field === "code"));
});
test("valid inventory preview retains zero-prefixed identifiers and typed quantities", async () => {
  const m = await service();
  assert.ok(m);
  const headers = [
    "code",
    "name",
    "category",
    "total",
    "fit",
    "condition",
    "location",
  ];
  const result = m.prepareBackendImport(
    "inventaris",
    { headers, rows: [["0007", "Alat", "Camp", "2", "1", "Baik", "Gudang"]] },
    Object.fromEntries(headers.map((h) => [h, h])),
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0].code, "0007");
  assert.equal(result.rows[0].fit, 1);
  assert.equal(result.rows[0].available, false);
});
