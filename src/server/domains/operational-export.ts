import { parseMediaUrl } from "@/lib/media-url";
import "server-only";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { DomainError } from "../errors";
import { getDb } from "../db";
import { requirePermission, type Principal } from "../auth/policy";
import { assertFresh } from "../auth/sessions";
import { applicantFields, periodSchema } from "./recruitment";
import { memberFields } from "../../lib/operational-schema";
import { listArchives } from "./archives";
import { readMedia } from "../media/storage";
import sharp from "sharp";
import { applicantPdfTable } from "./applicant-pdf";
export async function exportOperational(
  p: Principal,
  kind: "members" | "inventory" | "archives",
  format: "xlsx" | "pdf",
  archived = false,
) {
  const permission =
    kind === "members" ? "members:read" : kind === "inventory" ? "inventory:write" : "users:write";
  requirePermission(p, permission);
  let headers: string[], values: string[][];
  if (kind === "archives") {
    const rows = await listArchives(p, 10001);
    headers = ["Jenis", "ID", "Nama / kode", "Waktu arsip"];
    values = rows.map((r) => [r.kind, r.id, r.title, r.at]);
  } else {
    const snapshot = await getDb().$transaction(
      async (tx) => {
        await assertFresh(tx, p, permission);
        const where = { archivedAt: archived ? { not: null } : null };
        if (kind === "members") {
          if ((await tx.member.count({ where })) > 10000)
            throw new DomainError("EXPORT_LIMIT", 413);
          const sizes = await tx.$queryRaw<
            Array<{ bytes: bigint }>
          >`SELECT COALESCE(SUM(octet_length(fields::text)),0)::bigint AS bytes FROM "Member" WHERE (${archived} AND "archivedAt" IS NOT NULL) OR (NOT ${archived} AND "archivedAt" IS NULL)`;
          if (Number(sizes[0]?.bytes || 0) > 20 * 1024 * 1024)
            throw new DomainError("EXPORT_LIMIT", 413);
          const rows = await tx.member.findMany({
              where,
              orderBy: { id: "asc" },
              take: 10001,
            }),
            keys = Object.keys(memberFields.shape) as Array<keyof typeof memberFields.shape>;
          return {
            headers: keys.map((k) => k.replaceAll("_", " ")),
            values: rows.map((r) => {
              const fields = memberFields.parse(r.fields);
              return keys.map((k) => fields[k]);
            }),
          };
        }
        if ((await tx.equipment.count({ where })) > 10000)
          throw new DomainError("EXPORT_LIMIT", 413);
        const equipmentSizes = await tx.$queryRaw<
          Array<{ bytes: bigint }>
        >`SELECT COALESCE(SUM(octet_length(row_to_json(e)::text)),0)::bigint AS bytes FROM "Equipment" e WHERE (${archived} AND "archivedAt" IS NOT NULL) OR (NOT ${archived} AND "archivedAt" IS NULL)`;
        if (Number(equipmentSizes[0]?.bytes || 0) > 20 * 1024 * 1024)
          throw new DomainError("EXPORT_LIMIT", 413);
        const rows = await tx.equipment.findMany({
          where,
          orderBy: { code: "asc" },
          take: 10001,
        });
        const keys = [
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
          "available",
          "maxDays",
          "maxQuantity",
          "notes",
        ] as const;
        return {
          headers: [
            "Kode",
            "Nama",
            "Kategori",
            "Merek",
            "Tipe / warna",
            "Sumber",
            "Tahun masuk",
            "Total",
            "Layak",
            "Kondisi",
            "Lokasi",
            "Tersedia",
            "Maksimal hari",
            "Maksimal jumlah",
            "Catatan",
          ],
          values: rows.map((r) => keys.map((k) => String(r[k]))),
        };
      },
      { isolationLevel: "RepeatableRead", timeout: 20000 },
    );
    headers = snapshot.headers;
    values = snapshot.values;
  }
  return format === "xlsx"
    ? operationalWorkbook(kind, headers, values)
    : operationalPdf(kind, headers, values);
}
export function assertOperationalBudget(headers: string[], rows: string[][]) {
  if (
    rows.length > 10000 ||
    headers.length > 100 ||
    rows.length * headers.length > 200000 ||
    rows.reduce((n, r) => n + Buffer.byteLength(JSON.stringify(r)), 0) > 20 * 1024 * 1024 ||
    rows.some((r) => r.some((v) => v.length > 30000))
  )
    throw new DomainError(
      "EXPORT_LIMIT",
      413,
      "Ekspor terlalu besar. Persempit filter; data tidak diekspor sebagian.",
    );
}
export async function operationalWorkbook(title: string, headers: string[], rows: string[][]) {
  assertOperationalBudget(headers, rows);
  const wb = new ExcelJS.Workbook();
  wb.creator = "WAPALA";
  wb.title = title;
  const sheet = wb.addWorksheet("Data", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  sheet.columns.forEach((c) => {
    c.width = 28;
  });
  sheet.getRow(1).font = { bold: true };
  sheet.eachRow((r) => {
    r.alignment = { vertical: "top", wrapText: true };
  });
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, sheet.rowCount), column: headers.length },
  };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
export function operationalPdf(title: string, headers: string[], rows: string[][]) {
  assertOperationalBudget(headers, rows);
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  let y = 18;
  pdf.setFontSize(14);
  pdf.text(title, 15, y);
  y += 12;
  pdf.setFontSize(9);
  for (let i = 0; i < rows.length; i++) {
    const lines: string[] = [];
    headers.forEach((h, j) =>
      lines.push(...(pdf.splitTextToSize(h + ": " + (rows[i][j] || "—"), 180) as string[])),
    );
    for (const line of [String(i + 1) + ".", ...lines, ""]) {
      if (y > 280) {
        if (pdf.getNumberOfPages() >= 200)
          throw new DomainError("EXPORT_LIMIT", 413, "PDF melebihi 200 halaman. Persempit filter.");
        pdf.addPage();
        y = 18;
      }
      pdf.text(line, 15, y);
      y += 4.5;
    }
  }
  return Buffer.from(pdf.output("arraybuffer"));
}
export async function exportApplicants(p: Principal, year: number, format: "xlsx" | "pdf") {
  requirePermission(p, "recruitment:read");
  periodSchema.shape.year.parse(year);
  const rows = await getDb().$transaction(
    async (tx) => {
      await assertFresh(tx, p, "recruitment:read");
      if ((await tx.applicant.count({ where: { year } })) > 10000)
        throw new DomainError("EXPORT_LIMIT", 413);
      const sizes = await tx.$queryRaw<
        Array<{ bytes: bigint }>
      >`SELECT COALESCE(SUM(octet_length(fields::text)),0)::bigint AS bytes FROM "Applicant" WHERE year=${year}`;
      if (Number(sizes[0]?.bytes || 0) > 20 * 1024 * 1024)
        throw new DomainError("EXPORT_LIMIT", 413, "Isian periode melebihi batas ekspor.");
      const result = await tx.applicant.findMany({
        where: { year },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 10001,
      });
      return result.map((r) => ({
        code: r.code,
        photo: r.photo,
        time: r.createdAt.toISOString(),
        fields: applicantFields.parse(r.fields),
      }));
    },
    { isolationLevel: "RepeatableRead", timeout: 20000 },
  );
  const keys = Object.keys(applicantFields.shape) as Array<keyof typeof applicantFields.shape>;
  const headers = ["Kode", "Waktu", ...keys.map((k) => k.replaceAll("_", " "))];
  const values = rows.map((r) => [r.code, r.time, ...keys.map((k) => r.fields[k])]);
  if (format === "xlsx") return operationalWorkbook("OR " + year, headers, values);
  if (rows.length > 200)
    throw new DomainError(
      "EXPORT_LIMIT",
      413,
      "PDF maksimal 200 pendaftar. Gunakan Excel untuk periode yang lebih besar.",
    );
  const illustrated = [];
  for (const row of rows) {
    let photoData: string | undefined;
    const id = parseMediaUrl(row.photo);
    if (id) {
      try {
        const media = await readMedia(id, p);
        const thumbnail = await sharp(media.bytes)
          .resize({
            width: 180,
            height: 240,
            fit: "inside",
            withoutEnlargement: true,
          })
          .png()
          .toBuffer();
        photoData = "data:image/png;base64," + thumbnail.toString("base64");
      } catch (error) {
        if (error instanceof DomainError && error.status === 403) throw error;
        // Preserve all registration data even when an old photo is unavailable.
      }
    }
    illustrated.push({ ...row, photoData });
  }
  return applicantPdfTable(year, illustrated);
}
