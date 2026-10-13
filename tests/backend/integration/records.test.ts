import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../../../src/server/db";
import { clean, ctx } from "./helpers";
import {
  createBootstrapToken,
  bootstrap,
} from "../../../src/server/auth/bootstrap";
import { login } from "../../../src/server/auth/login";
import type { Principal } from "../../../src/server/auth/policy";
let su: Principal;
const service = () =>
  import("../../../src/server/domains/records").catch(() => null);
const member = (nia: string, nim: string) => ({
  nama: "Anggota Uji",
  nim,
  prodi: "Teknik",
  angkatan: "2026",
  jenis_kelamin: "Laki-laki",
  nia,
  status: "Aktif",
  kontak: "081234567890",
  nomor: "",
  foto: "",
});
beforeEach(async () => {
  await clean();
  const t = await createBootstrapToken(ctx);
  await bootstrap({ token: t.token, password: "member-test-passphrase" }, ctx);
  su = (
    await login(
      { email: "superuser@wapala.org", password: "member-test-passphrase" },
      ctx,
    )
  ).principal;
});
after(() => getDb().$disconnect());
test("historical members can have unavailable identifiers/contact and keep AB or AM status", async () => {
  const m = await service();
  assert.ok(m);
  await m.importMembers(
    su,
    [
      { ...member("0001", ""), kontak: "", status: "AB" },
      { ...member("0002", ""), kontak: "", status: "AM" },
    ],
    ctx,
  );
  const rows = await getDb().member.findMany({ orderBy: { nia: "asc" } });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].nim, null);
  assert.equal(rows[1].nim, null);
  const listed = await m.listMembers(su);
  assert.ok(
    listed.every(
      (r) =>
        (r.fields as { nim: string; kontak: string }).nim === "" &&
        (r.fields as { kontak: string }).kontak === "",
    ),
  );
});
test("member import retains leading zeros and conflicting batch rolls back entirely", async () => {
  const m = await service();
  assert.ok(m);
  await m.importMembers(su, [member("0001", "00123")], ctx);
  assert.equal((await m.listMembers(su))[0].fields.nim, "00123");
  await assert.rejects(
    m.importMembers(
      su,
      [member("0002", "00234"), member("0001", "00345")],
      ctx,
    ),
  );
  assert.equal((await m.listMembers(su)).length, 1);
  await assert.rejects(
    m.importMembers(
      su,
      [member("0003", "00456"), member("0003", "00567")],
      ctx,
    ),
  );
  assert.equal((await m.listMembers(su)).length, 1);
});
test("public content cannot disclose members and rejects executable media URLs", async () => {
  const m = await service();
  assert.ok(m);
  await m.importMembers(su, [member("0001", "00123")], ctx);
  await m.saveContent(
    su,
    "konten",
    {
      fields: {
        judul: "Berita Uji",
        slug: "berita-uji",
        tipe: "Berita",
        kategori: "Kegiatan",
        penulis: "WAPALA",
        tanggal: "2026-10-13",
        sampul: "",
        status: "Publik",
        ringkasan: "Ringkasan",
        isi: "<script>alert(1)</script> teks disimpan sebagai teks",
      },
    },
    ctx,
  );
  const data = await m.publicContent("konten");
  assert.equal(data.length, 1);
  assert.ok(!JSON.stringify(data).includes("00123"));
  await assert.rejects(
    m.saveContent(
      su,
      "galeri",
      { fields: { judul: "Uji", sampul: "javascript:alert(1)" } },
      ctx,
    ),
  );
});
