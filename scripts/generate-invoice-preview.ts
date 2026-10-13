import fs from "node:fs/promises";
import path from "node:path";
import QR from "qrcode";
import { seed } from "../tests/fixtures/seed";
import { buildInvoiceDocument } from "../src/lib/invoice-document";
async function main() {
  const loan = seed.loans[1];
  const logo =
    "data:image/png;base64," +
    (await fs.readFile("public/images/logo.png")).toString("base64");
  const telLogo =
    "data:image/png;base64," +
    (await fs.readFile("public/images/tel-u.png")).toString("base64");
  const qr = await QR.toDataURL(
    "http://127.0.0.1:3000/peminjaman/status/" + loan.code,
  );
  const doc = buildInvoiceDocument(loan, seed, { logo, telLogo, qr });
  const output = path.resolve("output/pdf");
  await fs.mkdir(output, { recursive: true });
  const filename = path.join(output, "Invoice-WPL4N8Q2-A4-dua-salinan.pdf");
  await fs.writeFile(filename, Buffer.from(doc.output("arraybuffer")));
  process.stdout.write(
    JSON.stringify({
      file: filename,
      pages: doc.getNumberOfPages(),
      width: doc.internal.pageSize.getWidth(),
      height: doc.internal.pageSize.getHeight(),
    }),
  );
}
void main();
