import { test } from "node:test";
import assert from "node:assert/strict";
import { seed } from "./fixtures/seed";
import { buildInvoiceDocument } from "../src/lib/invoice-document";

test("an approved loan prints two copies on a single A4 landscape sheet", () => {
  const doc = buildInvoiceDocument(seed.loans[1], seed, {});
  assert.equal(doc.getNumberOfPages(), 1);
  assert.ok(Math.abs(doc.internal.pageSize.getWidth() - 297) < 0.1);
  assert.ok(Math.abs(doc.internal.pageSize.getHeight() - 210) < 0.1);
  const pdf = doc.output();
  assert.equal((pdf.match(/WAPALA TELKOM UNIVERSITY/g) || []).length, 2);
  assert.equal((pdf.match(/\(WPL4N8Q2\) Tj/g) || []).length, 2);
  assert.ok(pdf.includes("Salinan peminjam"));
  assert.ok(pdf.includes("Arsip logistik"));
});
test("long equipment lists continue in matching pairs instead of running beyond the sheet", () => {
  const loan = {
    ...seed.loans[1],
    items: Array.from({ length: 30 }, () => seed.loans[1].items[0]),
  };
  const doc = buildInvoiceDocument(loan, seed, {});
  assert.ok(doc.getNumberOfPages() > 1);
  const text = doc.output();
  assert.equal(
    (text.match(/WAPALA TELKOM UNIVERSITY/g) || []).length,
    doc.getNumberOfPages() * 2,
  );
});
test("long borrower descriptions move to paired appendices instead of overlapping invoice terms", () => {
  const loan = {
    ...seed.loans[1],
    purpose: "Kegiatan lapangan ".repeat(60) + "Keterangan terakhir",
  };
  const doc = buildInvoiceDocument(loan, seed, {});
  assert.ok(doc.getNumberOfPages() > 1);
  assert.ok(doc.output().includes("Lampiran keterangan"));
  assert.ok(doc.output().includes("terakhir"));
});
