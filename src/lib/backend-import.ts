import { importFields, type ImportKind, type ImportTable } from "./import-data";
import { equipmentSchema, memberFields } from "./operational-schema";
export type ImportIssue = { row: number; field: string; message: string };
export const importLabels: Record<string, string> = {
  nomor: "Nomor urut",
  nama: "Nama lengkap",
  nim: "NIM",
  prodi: "Program studi",
  angkatan: "Angkatan",
  jenis_kelamin: "Jenis kelamin",
  nia: "NIA",
  status: "Status anggota",
  kontak: "Nomor kontak",
  foto: "Foto anggota",
  code: "Kode inventaris",
  name: "Nama alat",
  category: "Kategori",
  brand: "Merek",
  typeColor: "Tipe / warna",
  source: "Sumber pengadaan",
  yearEntered: "Tahun masuk",
  total: "Jumlah total",
  fit: "Jumlah layak",
  condition: "Kondisi",
  location: "Lokasi penyimpanan",
  photo: "Foto alat",
  notes: "Catatan",
};
export const requiredImportFields: Record<ImportKind, string[]> = {
  anggota: ["nama", "prodi", "angkatan", "jenis_kelamin", "nia", "status"],
  inventaris: ["code", "name", "category", "total", "fit", "condition", "location"],
};
export function prepareBackendImport(
  kind: ImportKind,
  table: ImportTable,
  mapping: Record<string, string>,
) {
  const errors: ImportIssue[] = [],
    rows: Record<string, string | number | boolean>[] = [];
  const fail = (row: number, field: string, message: string) => {
    if (!errors.some((e) => e.row === row && e.field === field && e.message === message))
      errors.push({ row, field, message });
  };
  const selected = Object.values(mapping).filter(Boolean);
  if (!table.rows.length || table.rows.length > 2000)
    fail(1, "file", "Pilih berkas berisi 1–2.000 baris data.");
  if (new Set(table.headers).size !== table.headers.length)
    fail(1, "header", "Nama kolom sumber harus unik.");
  if (new Set(selected).size !== selected.length)
    fail(1, "mapping", "Satu kolom sumber tidak boleh dipakai untuk dua field.");
  for (const field of requiredImportFields[kind])
    if (!mapping[field] || !table.headers.includes(mapping[field]))
      fail(1, field, "Kolom wajib belum dipetakan.");
  const displayRows = table.rows.map((values) =>
    Object.fromEntries(
      importFields[kind].map((field) => [
        field,
        mapping[field] ? String(values[table.headers.indexOf(mapping[field])] ?? "").trim() : "",
      ]),
    ),
  );
  const seen = new Map<string, number>();
  displayRows.forEach((raw, index) => {
    const row = index + 2;
    const candidate =
      kind === "anggota"
        ? raw
        : {
            ...raw,
            total: raw.total ? Number(raw.total) : NaN,
            fit: raw.fit ? Number(raw.fit) : NaN,
            available: false,
            maxDays: 7,
            maxQuantity: Math.max(1, Number(raw.fit) || 1),
          };
    const parsed =
      kind === "anggota" ? memberFields.safeParse(candidate) : equipmentSchema.safeParse(candidate);
    if (!parsed.success)
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] || "baris");
        const message =
          raw[field] === ""
            ? "Data belum tersedia / wajib diisi."
            : field === "condition"
              ? "Kondisi tidak dikenal. Gunakan Baik, Kotor, Rusak, Sebagian rusak, Rusak Ringan, Rusak Berat, atau Hilang."
              : field === "status"
                ? "Status harus Aktif, AB, AM, ALB, atau AK."
                : field === "jenis_kelamin"
                  ? "Gunakan Laki-laki atau Perempuan."
                  : field === "total" || field === "fit"
                    ? "Gunakan bilangan bulat 0–100.000; jumlah layak tidak boleh melebihi total."
                    : field === "foto" || field === "photo"
                      ? "Foto harus kosong atau berasal dari media terdaftar di aplikasi."
                      : "Format atau panjang data belum sesuai.";
        fail(row, field, message);
      }
    else rows.push(parsed.data);
    for (const field of kind === "anggota" ? ["nia", "nim"] : ["code"]) {
      const value = raw[field]?.toLowerCase();
      if (!value) continue;
      const key = field + ":" + value,
        previous = seen.get(key);
      if (previous)
        fail(
          row,
          field,
          "Identitas sama dengan baris " +
            previous +
            ". Periksa sebelum impor; tidak digabung otomatis.",
        );
      else seen.set(key, row);
    }
  });
  return { rows, displayRows, errors };
}
