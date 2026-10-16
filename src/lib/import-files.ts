import { parseCsv, importFields, type ImportTable, type ImportKind } from "./import-data";
export async function readImportFile(file: File): Promise<ImportTable> {
  if (file.size > 10 * 1024 * 1024) throw new Error("Ukuran file maksimal 10 MB.");
  const ext = file.name.split(".").at(-1)?.toLowerCase();
  if (ext === "csv") return parseCsv(await file.text());
  if (ext !== "xlsx") throw new Error("Gunakan file CSV atau XLSX, tanpa makro.");
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await file.arrayBuffer());
  const sheet = book.worksheets[0];
  if (!sheet) throw new Error("Workbook kosong.");
  if (sheet.rowCount > 2001 || sheet.columnCount > 100)
    throw new Error("Maksimal 2.000 baris data dan 100 kolom.");
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const values: string[] = [];
    for (let n = 1; n <= sheet.columnCount; n++) {
      const cell = row.getCell(n),
        value = cell.value;
      if (value && typeof value === "object") {
        if ("formula" in value || "sharedFormula" in value)
          throw new Error("Formula tidak diterima. Ubah ke nilai biasa.");
        if ("richText" in value) values.push(value.richText.map((v) => v.text).join(""));
        else if (value instanceof Date) values.push(value.toISOString().slice(0, 10));
        else throw new Error("Tipe sel tidak didukung. Gunakan teks atau angka.");
      } else if (typeof value === "number") {
        const sections = cell.numFmt.split(";");
        const raw =
          value === 0 && sections[2]
            ? sections[2]
            : value < 0 && sections[1]
              ? sections[1]
              : sections[0];
        const format = raw.replace(
          /\[(?:Black|Blue|Cyan|Green|Magenta|Red|White|Yellow|Color\d+)\]/gi,
          "",
        );
        if (/^-?0+$/.test(format) && Number.isInteger(value)) {
          const width = format.replace("-", "").length;
          values.push((value < 0 ? "-" : "") + String(Math.abs(value)).padStart(width, "0"));
        } else if (/0{2,}/.test(format) && !/^0\.0+$/.test(format)) {
          throw new Error(
            "Format angka berawalan nol tidak didukung. Ubah identitas menjadi teks sebelum impor.",
          );
        } else values.push(String(value));
      } else values.push(value == null ? "" : String(value));
    }
    if (values.some((v) => v.trim())) rows.push(values);
  });
  if (!rows.length) throw new Error("Workbook kosong.");
  return { headers: rows[0], rows: rows.slice(1) };
}
export async function downloadImportTemplate(kind: ImportKind) {
  const content = "\ufeff" + importFields[kind].join(",") + "\r\n";
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "Template-" + kind + ".csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
