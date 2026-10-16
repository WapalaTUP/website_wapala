import "server-only";
import { jsPDF } from "jspdf";
import { DomainError } from "../errors";
import { orFieldLabel } from "../../lib/recruitment-fields";

export type ApplicantPdfRow = {
  code: string;
  time: string;
  fields: Record<string, string>;
  photoData?: string;
};

export function applicantPdfTable(year: number, rows: ApplicantPdfRow[]) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const left = 14,
    width = 182,
    labelWidth = 49;
  let y = 0;
  function pageHeader(row?: ApplicantPdfRow, continuation = false) {
    pdf.setTextColor(24, 36, 34);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("PENDAFTAR OPEN RECRUITMENT", 105, 17, { align: "center" });
    pdf.setFontSize(10);
    pdf.text("WAPALA - Periode " + year, 105, 24, { align: "center" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    if (row) {
      pdf.text(row.code + (continuation ? " (lanjutan)" : ""), left, 37);
      pdf.text(
        "Tanggal daftar: " +
          new Date(row.time).toLocaleDateString("id-ID", {
            timeZone: "Asia/Jakarta",
          }),
        left,
        43,
      );
      if (!continuation && row.photoData) {
        const properties = pdf.getImageProperties(row.photoData);
        const scale = Math.min(27 / properties.width, 34 / properties.height);
        const w = properties.width * scale,
          h = properties.height * scale;
        pdf.addImage(row.photoData, "PNG", 181 - w / 2, 33, w, h);
      } else if (!continuation) {
        pdf.setFontSize(8);
        pdf.text("Foto tidak tersedia", 181, 47, { align: "center" });
      }
    }
    y = continuation ? 52 : 73;
    pdf.setFillColor(236, 242, 238);
    pdf.rect(left, y, width, 8, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("Data pendaftar", left + 3, y + 5);
    pdf.text("Isian", left + labelWidth + 3, y + 5);
    y += 8;
  }
  function nextPage(row: ApplicantPdfRow, continuation: boolean) {
    if (pdf.getNumberOfPages() >= 200)
      throw new DomainError(
        "EXPORT_LIMIT",
        413,
        "PDF melebihi 200 halaman. Persempit periode ekspor.",
      );
    pdf.addPage();
    pageHeader(row, continuation);
  }
  if (!rows.length) {
    pageHeader();
    pdf.text("Belum ada pendaftar pada periode ini.", left, y + 12);
  }
  rows.forEach((row, index) => {
    if (index) nextPage(row, false);
    else pageHeader(row);
    for (const [key, value] of Object.entries(row.fields)) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      const label = orFieldLabel(key);
      const allLines = pdf.splitTextToSize(value || "-", width - labelWidth - 6) as string[];
      let offset = 0;
      while (offset < allLines.length) {
        if (y + 13 > 279) nextPage(row, true);
        const capacity = Math.max(1, Math.floor((279 - y - 6) / 4.2));
        const lines = allLines.slice(offset, offset + capacity);
        const labelLines = pdf.splitTextToSize(
          label + (offset ? " (lanjutan)" : ""),
          labelWidth - 6,
        ) as string[];
        const height = Math.max(lines.length, labelLines.length) * 4.2 + 6;
        if (y + height > 279) {
          nextPage(row, true);
          continue;
        }
        pdf.setDrawColor(190, 205, 196);
        pdf.setLineWidth(0.15);
        pdf.rect(left, y, labelWidth, height);
        pdf.rect(left + labelWidth, y, width - labelWidth, height);
        pdf.text(labelLines, left + 3, y + 5, { lineHeightFactor: 1.3 });
        pdf.text(lines, left + labelWidth + 3, y + 5, {
          lineHeightFactor: 1.3,
        });
        offset += lines.length;
        y += height;
      }
    }
  });
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text("Administrasi WAPALA - data pendaftar privat", left, 289);
    pdf.text(`${page} / ${pdf.getNumberOfPages()}`, 196, 289, {
      align: "right",
    });
  }
  return Buffer.from(pdf.output("arraybuffer"));
}
