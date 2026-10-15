import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { getDb } from "../../../src/server/db";
import { clean, ctx } from "./helpers";
import {
  createBootstrapToken,
  bootstrap,
} from "../../../src/server/auth/bootstrap";
import { login } from "../../../src/server/auth/login";
import {
  restoreArchive,
  listArchives,
} from "../../../src/server/domains/archives";
import { exportOperational } from "../../../src/server/domains/operational-export";
beforeEach(clean);
after(() => getDb().$disconnect());
test("archived records export completely restore once and preserve stock and private publication", async () => {
  const token = await createBootstrapToken(ctx);
  await bootstrap(
    { token: token.token, password: "archive-test-passphrase" },
    ctx,
  );
  const { principal } = await login(
      { email: "superuser@wapala.org", password: "archive-test-passphrase" },
      ctx,
    ),
    db = getDb(),
    at = new Date();
  const member = await db.member.create({
    data: {
      nia: "001",
      nim: "00123",
      archivedAt: at,
      fields: {
        nomor: "01",
        nama: "Anggota uji",
        nim: "00123",
        prodi: "Informatika",
        angkatan: "21",
        jenis_kelamin: "Laki-laki",
        nia: "001",
        status: "AB",
        kontak: "",
        foto: "",
      },
    },
  });
  const equipment = await db.equipment.create({
    data: {
      code: "0001",
      name: "Alat uji",
      category: "Alat",
      total: 10,
      fit: 7,
      condition: "Baik",
      location: "Gudang",
      available: true,
      archivedAt: at,
    },
  });
  const content = await db.contentRecord.create({
    data: {
      kind: "buku",
      fields: { judul: "Buku arsip", file: "", status: "Publik" },
      published: true,
      archivedAt: at,
    },
  });
  assert.equal((await listArchives(principal)).length, 3);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(
    (await exportOperational(
      principal,
      "members",
      "xlsx",
      true,
    )) as unknown as Parameters<typeof wb.xlsx.load>[0],
  );
  assert.equal(wb.worksheets[0].getCell("C2").value, "00123");
  assert.equal(
    (await exportOperational(principal, "inventory", "pdf", true))
      .subarray(0, 5)
      .toString(),
    "%PDF-",
  );
  await restoreArchive(
    principal,
    { kind: "anggota", id: member.id, at: at.toISOString() },
    ctx,
  );
  await assert.rejects(
    restoreArchive(
      principal,
      { kind: "anggota", id: member.id, at: at.toISOString() },
      ctx,
    ),
    { code: "CONFLICT" },
  );
  await restoreArchive(
    principal,
    { kind: "inventaris", id: equipment.id, at: at.toISOString() },
    ctx,
  );
  const restored = await db.equipment.findUniqueOrThrow({
    where: { id: equipment.id },
  });
  assert.equal(restored.fit, 7);
  assert.equal(restored.total, 10);
  assert.equal(restored.available, false);
  await restoreArchive(
    principal,
    { kind: "buku", id: content.id, at: at.toISOString() },
    ctx,
  );
  const book = await db.contentRecord.findUniqueOrThrow({
    where: { id: content.id },
  });
  assert.equal(book.published, false);
  assert.equal((book.fields as { status: string }).status, "Draft");
  assert.equal(
    await db.auditLog.count({ where: { action: "ARCHIVE_RESTORED" } }),
    3,
  );
  await assert.rejects(
    exportOperational({ ...principal, role: "MULTIMEDIA" }, "members", "xlsx"),
    { code: "FORBIDDEN" },
  );
  await assert.rejects(
    restoreArchive(
      { ...principal, role: "POH" },
      { kind: "buku", id: content.id, at: at.toISOString() },
      ctx,
    ),
    { code: "FORBIDDEN" },
  );
});
