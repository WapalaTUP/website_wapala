"use client";
import type { Applicant, DemoState, Loan } from "./types";
import { money } from "./content";
async function imageData(path: string) {
  const blob = await fetch(path).then((r) => r.blob());
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
export async function invoicePdf(loan: Loan, state: DemoState) {
  const [builder, QR, logo, telLogo] = await Promise.all([
    import("./invoice-document"),
    import("qrcode"),
    imageData("/images/logo.png"),
    imageData("/images/tel-u.png"),
  ]);
  const qr = await QR.toDataURL(
    location.origin + "/peminjaman/status/" + loan.code,
  );
  builder
    .buildInvoiceDocument(loan, state, { logo, telLogo, qr })
    .save("Invoice-" + loan.code + "-A4.pdf");
}
export async function applicantPdf(a: Applicant) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.text("Form pendaftaran WAPALA", 18, 23);
  doc.setFontSize(11);
  doc.text(a.code + " / " + a.period, 18, 34);
  let y = 50;
  for (const [key, value] of Object.entries(a.fields)) {
    const lines = doc.splitTextToSize(
      key.replace(/_/g, " ") + ": " + value,
      174,
    );
    if (y + lines.length * 6 > 278) {
      doc.addPage();
      y = 20;
    }
    doc.text(lines, 18, y);
    y += lines.length * 6 + 4;
  }
  doc.text("Pas foto: " + a.photoName, 18, Math.min(y + 8, 284));
  doc.save("Pendaftaran-" + a.code + ".pdf");
}
export async function exportRows(
  title: string,
  rows: Record<string, string | number>[],
  format: "xlsx" | "pdf",
) {
  if (format === "xlsx") {
    const ExcelJS = await import("exceljs");
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet(title.slice(0, 30));
    const keys = Object.keys(rows[0] || { Keterangan: "" });
    sheet.columns = keys.map((k) => ({ header: k, key: k, width: 28 }));
    rows.forEach((row) => sheet.addRow(row));
    sheet.getRow(1).font = { bold: true };
    const bytes = await book.xlsx.writeBuffer();
    const url = URL.createObjectURL(
      new Blob([bytes as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = title + ".xlsx";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(title, 16, 20);
    doc.setFontSize(9);
    let y = 33;
    for (const row of rows) {
      const lines = doc.splitTextToSize(
        Object.entries(row)
          .map(([k, v]) => k + ": " + v)
          .join(" | "),
        178,
      );
      if (y + lines.length * 5 > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(lines, 16, y);
      y += lines.length * 5 + 10;
    }
    doc.save(title + ".pdf");
  }
}
export const donationLabel = (n: number) => money(n);
