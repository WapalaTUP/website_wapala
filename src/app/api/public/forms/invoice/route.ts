import { z } from "zod";
import { jsPDF } from "jspdf";
import { route } from "@/server/http/auth-handler";
import { readJson } from "@/server/http/body";
import { publicFormRequest, verifyPublicCapability } from "@/server/domains/public-forms";
import { getDb } from "@/server/db";
import { DomainError } from "@/server/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({ capability: z.string().min(1).max(2048) }).strict();
export function POST(request: Request) {
  return route(request, async ctx => {
    const owner = await publicFormRequest(request, ctx, "invoice");
    const { capability } = await readJson(request, schema), cap = verifyPublicCapability(capability, owner, "loan");
    const row = await getDb().loan.findUnique({ where: { id: cap.id }, include: { items: { include: { equipment: { select: { name: true, code: true } } } } } });
    if (!row || row.archivedAt || row.status === "requested" || row.status === "rejected" || !row.items.some(i => i.approved > 0)) throw new DomainError("INVOICE_UNAVAILABLE",409,"Invoice tersedia setelah pengajuan disetujui.");
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const lines: string[] = [
      `Kode: ${row.code}`, `Lembaga: ${row.institution}`, `Penanggung jawab: ${row.pic}`,
      `Telepon: ${row.phone}`, `Tanggal: ${row.start.toISOString().slice(0,10)} s.d. ${row.end.toISOString().slice(0,10)}`,
      `Kegiatan: ${row.event}`, `Keperluan: ${row.purpose}`, `Jaminan: ${row.collateral}`, "", "Alat disetujui:",
      ...row.items.filter(i=>i.approved>0).map(i => `${i.equipment.code} - ${i.equipment.name}: ${i.approved}`),
      "", `Status: ${row.status}`, `Denda: Rp ${Number(row.penalty).toLocaleString("id-ID")} (${row.penaltyStatus})`,
      "", "Barang wajib dikembalikan sesuai jadwal dan kondisi serah terima.",
      "Verifikasi pengembalian dilakukan oleh pengelola inventaris.",
      "", "Peminjam: ____________________", "Petugas WAPALA: ____________________",
    ].flatMap(line=>pdf.splitTextToSize(line.replace(/[\r\n\x00-\x1f]/g," "),124) as string[]);
    const perPage = 32, pages = Math.ceil(lines.length/perPage);
    for(let page=0;page<pages;page++) {
      if(page)pdf.addPage("a4","landscape");
      for(const [index,label] of ["Salinan WAPALA","Salinan peminjam"].entries()) {
        const x=10+index*148.5;
        pdf.setTextColor(220);pdf.setFontSize(26);pdf.text("WAPALA",x+40,105,{angle:35});
        pdf.setTextColor(0);pdf.setFontSize(16);pdf.text("WAPALA",x,16);
        pdf.setFontSize(10);pdf.text("INVOICE PEMINJAMAN",x,24);pdf.text(label,x,30);
        pdf.line(x,34,x+128,34);pdf.setFontSize(9);
        lines.slice(page*perPage,(page+1)*perPage).forEach((line,i)=>pdf.text(line,x,41+i*4.6));
        pdf.setFontSize(8);pdf.text(`${row.code} - Halaman ${page+1}/${pages}`,x,201);
      }
      pdf.setDrawColor(160);pdf.line(148.5,5,148.5,205);
    }
    return new Response(new Uint8Array(pdf.output("arraybuffer")), { headers: {
      "Content-Type":"application/pdf", "Content-Disposition":`attachment; filename="invoice-${row.code}.pdf"`,
      "Cache-Control":"private, no-store", "Referrer-Policy":"no-referrer", "X-Content-Type-Options":"nosniff",
    } });
  });
}
