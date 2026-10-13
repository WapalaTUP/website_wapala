import { jsPDF } from "jspdf";
import type { DemoState, Loan } from "./types";
import { date } from "./content";
export interface InvoiceAssets {
  logo?: string;
  telLogo?: string;
  qr?: string;
}
export function buildInvoiceDocument(
  loan: Loan,
  state: DemoState,
  assets: InvoiceAssets,
) {
  const doc = new jsPDF({ orientation: "landscape", format: "a4", unit: "mm" });
  const half = doc.internal.pageSize.getWidth() / 2;
  const margin = 8,
    contentWidth = half - margin * 2;
  const pairs = [
    [
      ["PIC", loan.pic],
      ["Lembaga", loan.institution],
    ],
    [
      ["Telepon", loan.phone],
      ["Kegiatan", loan.event],
    ],
    [
      ["Tanggal ambil", date(loan.start)],
      ["Tanggal kembali", date(loan.end)],
    ],
    [
      ["Jaminan", loan.collateral],
      ["Keperluan", loan.purpose],
    ],
  ];
  doc.setFontSize(7.5);
  const info = pairs.map((pair) =>
    pair.map(([label, value]) => ({
      label,
      lines: doc.splitTextToSize(value, contentWidth / 2 - 6) as string[],
    })),
  );
  const overflowInfo = info.flat().filter((entry) => entry.lines.length > 2);
  const compactInfo = info.map((row) =>
    row.map((entry) => ({
      ...entry,
      lines:
        entry.lines.length > 2
          ? [entry.lines[0], "(Lihat lampiran keterangan)"]
          : entry.lines,
    })),
  );
  const infoEnd =
    64 +
    compactInfo.reduce(
      (height, row) =>
        height + Math.max(...row.map((v) => v.lines.length)) * 3.5 + 6,
      0,
    );
  const tableTop = infoEnd + 5;
  doc.setFontSize(7.5);
  const rows = loan.items
    .filter((item) => item.approved > 0)
    .map((item, i) => {
      const name =
        state.equipment.find((e) => e.id === item.equipmentId)?.name ||
        item.equipmentId;
      const nameLines = doc.splitTextToSize(name, 76) as string[];
      const conditionLines = doc.splitTextToSize(
        item.outCondition,
        23,
      ) as string[];
      return {
        number: i + 1,
        quantity: item.approved,
        nameLines,
        conditionLines,
        height: Math.max(nameLines.length, conditionLines.length) * 3.5 + 3,
      };
    });
  const pages: (typeof rows)[] = [[]];
  let occupied = tableTop + 8;
  for (const row of rows) {
    if (occupied + row.height > 147 && pages.at(-1)!.length) {
      pages.push([]);
      occupied = tableTop + 8;
    }
    pages.at(-1)!.push(row);
    occupied += row.height;
  }
  doc.setProperties({
    title: "Invoice " + loan.code,
    author: "WAPALA Telkom University",
    subject: "Dua salinan A5 dalam satu halaman A4 landscape",
  });
  pages.forEach((pageRows, pageIndex) => {
    if (pageIndex) doc.addPage("a4", "landscape");
    for (const copy of [0, 1]) {
      const x = copy * half;
      const center = x + half / 2;
      const left = x + margin,
        right = x + half - margin;
      const label = copy === 0 ? "Salinan peminjam" : "Arsip logistik";
      if (assets.logo) {
        doc.saveGraphicsState();
        doc.setGState(doc.GState({ opacity: 0.075 }));
        doc.addImage(
          assets.logo,
          "PNG",
          center - 29,
          73,
          58,
          86,
          "wapala-logo",
          "FAST",
        );
        doc.restoreGraphicsState();
        doc.addImage(
          assets.logo,
          "PNG",
          left,
          8,
          10,
          15,
          "wapala-logo",
          "FAST",
        );
      }
      if (assets.telLogo)
        doc.addImage(
          assets.telLogo,
          "PNG",
          right - 23,
          10,
          23,
          7.88,
          "telu-header",
          "FAST",
        );
      doc.setTextColor(24, 36, 34);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.6);
      doc.text("WAPALA TELKOM UNIVERSITY", center, 13, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.9);
      doc.text(doc.splitTextToSize(state.settings.address, 96), center, 18, {
        align: "center",
        lineHeightFactor: 1.15,
      });
      doc.text(state.settings.email, center, 26, { align: "center" });
      doc.setDrawColor(40, 100, 65);
      doc.setLineWidth(0.35);
      doc.line(left, 30, right, 30);
      doc.setFontSize(6.8);
      doc.setTextColor(86, 105, 95);
      doc.text(label, left, 35);
      doc.setTextColor(24, 36, 34);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Peminjaman alat", left, 43);
      doc.setFontSize(9);
      doc.text(loan.code, left, 50);
      if (assets.qr)
        doc.addImage(
          assets.qr,
          "PNG",
          right - 22,
          36,
          22,
          22,
          "loan-qr",
          "FAST",
        );
      let y = 64;
      for (const row of compactInfo) {
        row.forEach((entry, col) => {
          const columnX = left + col * (contentWidth / 2 + 1);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.5);
          doc.setTextColor(86, 105, 95);
          doc.text(entry.label, columnX, y);
          doc.setFontSize(7.5);
          doc.setTextColor(24, 36, 34);
          doc.text(entry.lines, columnX, y + 4, { lineHeightFactor: 1.3 });
        });
        y += Math.max(...row.map((v) => v.lines.length)) * 3.5 + 6;
      }
      y = tableTop;
      doc.setFillColor(236, 242, 238);
      doc.rect(left, y, contentWidth, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      const columns = [left + 2, left + 10, left + 92, left + 109];
      ["No", "Nama barang", "Jumlah", "Kondisi"].forEach((heading, i) =>
        doc.text(heading, columns[i], y + 4.5),
      );
      y += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      for (const row of pageRows) {
        doc.text(String(row.number), columns[0], y + 3.5);
        doc.text(row.nameLines, columns[1], y + 3.5, { lineHeightFactor: 1.3 });
        doc.text(String(row.quantity), columns[2] + 3, y + 3.5);
        doc.text(row.conditionLines, columns[3], y + 3.5, {
          lineHeightFactor: 1.3,
        });
        y += row.height;
        doc.setDrawColor(205, 218, 209);
        doc.setLineWidth(0.15);
        doc.line(left, y, right, y);
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.4);
      doc.text("Ketentuan peminjaman", left, 156);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      const terms =
        "Alat dikembalikan bersih dan sesuai kondisi. Peminjam bertanggung jawab atas kerusakan atau kehilangan. Pengembalian tepat waktu; denda keterlambatan Rp2.000 per hari.";
      doc.text(doc.splitTextToSize(terms, contentWidth), left, 161, {
        lineHeightFactor: 1.3,
      });
      doc.setFontSize(7.5);
      doc.text("Penerima", left + 29, 181, { align: "center" });
      doc.text("Logistik WAPALA", right - 29, 181, { align: "center" });
      doc.setDrawColor(130, 150, 138);
      doc.line(left + 5, 195, left + 53, 195);
      doc.line(right - 53, 195, right - 5, 195);
      doc.setFontSize(6.2);
      doc.setTextColor(86, 105, 95);
      doc.text("Pratinjau frontend - data contoh", left, 202);
      doc.text(
        loan.code + " / " + (pageIndex + 1) + " dari " + pages.length,
        right,
        202,
        { align: "right" },
      );
    }
    doc.setDrawColor(170, 180, 172);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(half, 5, half, 205);
    doc.setLineDashPattern([], 0);
  });
  for (const entry of overflowInfo) {
    const all = entry.lines;
    for (let offset = 0; offset < all.length; offset += 40) {
      doc.addPage("a4", "landscape");
      for (const copy of [0, 1]) {
        const left = copy * half + margin,
          center = copy * half + half / 2;
        doc.setTextColor(24, 36, 34);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("WAPALA TELKOM UNIVERSITY", center, 14, { align: "center" });
        doc.setFontSize(13);
        doc.text("Lampiran keterangan", left, 30);
        doc.setFontSize(8);
        doc.text(loan.code + " / " + entry.label, left, 39);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text(all.slice(offset, offset + 40), left, 49, {
          lineHeightFactor: 1.3,
        });
        doc.setFontSize(7);
        doc.text(copy === 0 ? "Salinan peminjam" : "Arsip logistik", left, 200);
      }
      doc.setDrawColor(170, 180, 172);
      doc.setLineDashPattern([2, 2], 0);
      doc.line(half, 5, half, 205);
      doc.setLineDashPattern([], 0);
    }
  }
  return doc;
}
