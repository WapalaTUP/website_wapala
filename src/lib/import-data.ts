import type { DemoState, Equipment } from "./types";
import { conditions } from "./content";
export type ImportKind = "anggota" | "inventaris";
export type ImportTable = { headers: string[]; rows: string[][] };
export type ImportPreview = {
  rows: Record<string, string>[];
  errors: { row: number; field: string; message: string }[];
};
export const importFields: Record<ImportKind, string[]> = {
  anggota: [
    "nomor",
    "nama",
    "nim",
    "prodi",
    "angkatan",
    "jenis_kelamin",
    "nia",
    "status",
    "kontak",
    "foto",
  ],
  inventaris: [
    "code",
    "name",
    "category",
    "brand",
    "typeColor",
    "source",
    "yearEntered",
    "total",
    "fit",
    "condition",
    "location",
    "photo",
    "notes",
  ],
};
const required: Record<ImportKind, string[]> = {
  anggota: [
    "nama",
    "nim",
    "prodi",
    "angkatan",
    "jenis_kelamin",
    "nia",
    "status",
    "kontak",
  ],
  inventaris: [
    "code",
    "name",
    "category",
    "total",
    "fit",
    "condition",
    "location",
  ],
};
export function normalizeImportHeader(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}
export function parseCsv(text: string): ImportTable {
  text = text.replace(/^\ufeff/, "");
  const first = text.split(/\r?\n/)[0] || "";
  let inQuotes = false,
    commas = 0,
    semicolons = 0;
  for (const ch of first) {
    if (ch === '"') inQuotes = !inQuotes;
    if (!inQuotes) {
      if (ch === ",") commas++;
      if (ch === ";") semicolons++;
    }
  }
  const delimiter = semicolons > commas ? ";" : ",";
  const out: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    afterQuote = false;
  const pushRow = () => {
    row.push(cell);
    if (row.some((v) => v.trim())) out.push(row);
    row = [];
    cell = "";
    afterQuote = false;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else cell += ch;
    } else if (ch === '"') {
      if (cell || afterQuote) throw new Error("Format kutip CSV tidak valid.");
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
      afterQuote = false;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      pushRow();
    } else {
      if (afterQuote && !/\s/.test(ch))
        throw new Error("Format CSV setelah kutip tidak valid.");
      if (!afterQuote) cell += ch;
    }
  }
  if (quoted) throw new Error("Kutip CSV belum ditutup.");
  pushRow();
  const headers = out.shift() || [];
  if (!headers.length) throw new Error("File tidak memiliki header.");
  if (out.length > 2000) throw new Error("Maksimal 2.000 baris.");
  if (headers.length > 100 || out.some((r) => r.length !== headers.length))
    throw new Error("Jumlah kolom tidak konsisten atau terlalu banyak.");
  return { headers, rows: out };
}
export function validateImport(
  kind: ImportKind,
  table: ImportTable,
  mapping: Record<string, string>,
  state: DemoState,
): ImportPreview {
  const result: ImportPreview = { rows: [], errors: [] };
  const fail = (row: number, field: string, message: string) =>
    result.errors.push({ row, field, message });
  if (!table.rows.length || table.rows.length > 2000) {
    fail(1, "file", "Isi 1 sampai 2.000 baris data.");
    return result;
  }
  if (new Set(table.headers).size !== table.headers.length) {
    fail(1, "header", "Nama kolom harus unik.");
    return result;
  }
  for (const key of required[kind])
    if (!mapping[key] || !table.headers.includes(mapping[key]))
      fail(1, key, "Petakan kolom wajib.");
  const chosen = Object.values(mapping).filter(Boolean);
  if (new Set(chosen).size !== chosen.length)
    fail(1, "mapping", "Satu kolom sumber tidak boleh dipakai dua kali.");
  const identifier = kind === "anggota" ? "nia" : "code",
    ids = new Set<string>(),
    nims = new Set<string>();
  for (const item of kind === "anggota"
    ? state.records.anggota
    : state.equipment) {
    const fields = "fields" in item ? item.fields : item;
    ids.add(
      String(fields[identifier as keyof typeof fields] || "")
        .trim()
        .toLowerCase(),
    );
    if ("fields" in item)
      nims.add((item.fields.nim || "").trim().toLowerCase());
  }
  table.rows.forEach((source, i) => {
    const row = Object.fromEntries(
      importFields[kind].map((key) => [
        key,
        mapping[key]
          ? String(source[table.headers.indexOf(mapping[key])] ?? "").trim()
          : "",
      ]),
    );
    result.rows.push(row);
    for (const key of required[kind])
      if (!row[key]) fail(i + 2, key, "Wajib diisi.");
    const id = row[identifier].toLowerCase();
    if (id && ids.has(id))
      fail(i + 2, identifier, "Identitas duplikat / sudah ada.");
    ids.add(id);
    if (kind === "anggota") {
      const nim = row.nim.toLowerCase();
      if (nim && nims.has(nim)) fail(i + 2, "nim", "NIM duplikat / sudah ada.");
      nims.add(nim);
      if (row.status && !["Aktif", "ALB", "AK"].includes(row.status))
        fail(i + 2, "status", "Gunakan Aktif, ALB, atau AK.");
      if (
        row.jenis_kelamin &&
        !["Laki-laki", "Perempuan"].includes(row.jenis_kelamin)
      )
        fail(i + 2, "jenis_kelamin", "Gunakan Laki-laki atau Perempuan.");
    } else {
      for (const key of ["total", "fit"])
        if (!/^\d+$/.test(row[key]) || !Number.isSafeInteger(Number(row[key])))
          fail(i + 2, key, "Isi bilangan bulat nol atau lebih.");
      if (Number(row.fit) > Number(row.total))
        fail(i + 2, "fit", "Jumlah layak melebihi total.");
      if (
        row.condition &&
        !conditions.includes(row.condition as Equipment["condition"])
      )
        fail(i + 2, "condition", "Kondisi tidak dikenal.");
      if (
        row.yearEntered &&
        (!/^\d{4}$/.test(row.yearEntered) || Number(row.yearEntered) < 1900)
      )
        fail(i + 2, "yearEntered", "Isi tahun empat digit.");
    }
    for (const key of kind === "anggota" ? ["foto"] : ["photo"])
      if (
        row[key] &&
        !/^https?:\/\//i.test(row[key]) &&
        !row[key].startsWith("/images/")
      )
        fail(i + 2, key, "Gunakan URL http(s) atau aset /images/.");
  });
  return result;
}
export function applyImport(
  state: DemoState,
  kind: ImportKind,
  preview: ImportPreview,
) {
  if (preview.errors.length || !preview.rows.length)
    throw new Error("Perbaiki seluruh error sebelum impor.");
  const keys = importFields[kind],
    table = {
      headers: keys,
      rows: preview.rows.map((r) => keys.map((k) => r[k] || "")),
    };
  const current = validateImport(
    kind,
    table,
    Object.fromEntries(keys.map((k) => [k, k])),
    state,
  );
  if (current.errors.length)
    throw new Error("Data berubah atau duplikat. Periksa preview lagi.");
  for (const row of current.rows) {
    if (kind === "anggota")
      state.records.anggota.push({ id: crypto.randomUUID(), fields: row });
    else
      state.equipment.push({
        id: crypto.randomUUID(),
        code: row.code,
        name: row.name,
        category: row.category,
        brand: row.brand,
        typeColor: row.typeColor,
        source: row.source,
        yearEntered: row.yearEntered,
        photo: row.photo,
        total: Number(row.total),
        fit: Number(row.fit),
        condition: row.condition as Equipment["condition"],
        location: row.location,
        notes: row.notes,
        available: false,
        maxDays: 7,
        maxQuantity: Number(row.fit),
      });
  }
}
