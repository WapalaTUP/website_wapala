import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../../../src/server/db";
import { clean, ctx } from "./helpers";
import {
  createBootstrapToken,
  bootstrap,
} from "../../../src/server/auth/bootstrap";
import { login } from "../../../src/server/auth/login";
import {
  importMembers,
  saveContent,
} from "../../../src/server/domains/records";
import { saveCampaign } from "../../../src/server/domains/campaigns";
import { saveEquipment } from "../../../src/server/domains/inventory";
const service = () =>
  import("../../../src/server/public-data").catch(() => null);
beforeEach(clean);
after(() => getDb().$disconnect());
test("fresh database public state has no mock records, active recruitment or private collections", async () => {
  const m = await service();
  assert.ok(m);
  const state = await m.publicState();
  assert.equal(state.backend, true);
  assert.deepEqual(state.campaigns, []);
  assert.deepEqual(state.records.konten, []);
  assert.deepEqual(state.equipment, []);
  assert.equal(state.settings.recruitmentActive, false);
  assert.deepEqual(state.loans, []);
  assert.deepEqual(state.applicants, []);
  assert.deepEqual(state.donations, []);
});
test("public state uses published database records while excluding members, draft campaigns and credentials", async () => {
  const m = await service();
  assert.ok(m);
  const t = await createBootstrapToken(ctx);
  await bootstrap(
    { token: t.token, password: "public-state-test-passphrase" },
    ctx,
  );
  const su = (
    await login(
      {
        email: "superuser@wapala.org",
        password: "public-state-test-passphrase",
      },
      ctx,
    )
  ).principal;
  await importMembers(
    su,
    [
      {
        nama: "PRIVATE-MEMBER",
        nim: "00123",
        nia: "0001",
        prodi: "Teknik",
        angkatan: "2026",
        jenis_kelamin: "Laki-laki",
        status: "Aktif",
        kontak: "081234567890",
      },
    ],
    ctx,
  );
  await saveContent(
    su,
    "konten",
    {
      fields: {
        judul: "Public Post",
        slug: "public-post",
        tipe: "Berita",
        kategori: "Kegiatan",
        penulis: "Organisasi",
        tanggal: "2026-10-13",
        status: "Publik",
        isi: "Isi berita",
        sampul: "",
        ringkasan: "Ringkasan",
      },
    },
    ctx,
  );
  await saveCampaign(
    su,
    {
      title: "PRIVATE-DRAFT",
      description: "Keterangan",
      target: 1000,
      collaborator: "Uji",
      start: "",
      end: "",
      status: "draft",
      cover: "",
      poster: "",
      qrisImage: "",
      bankAccounts: [],
    },
    ctx,
  );
  const state = await m.publicState();
  const json = JSON.stringify(state);
  assert.equal(state.records.konten[0].fields.judul, "Public Post");
  for (const secret of [
    "PRIVATE-MEMBER",
    "PRIVATE-DRAFT",
    "passwordHash",
    "phoneDigest",
    "csrfDigest",
  ])
    assert.ok(!json.includes(secret));
});
test("public catalog includes unavailable equipment without revealing stock quantities or storage locations", async () => {
  const m = await service();
  assert.ok(m);
  const t = await createBootstrapToken(ctx);
  await bootstrap(
    { token: t.token, password: "public-stock-test-passphrase" },
    ctx,
  );
  const su = (
    await login(
      {
        email: "superuser@wapala.org",
        password: "public-stock-test-passphrase",
      },
      ctx,
    )
  ).principal;
  await saveEquipment(
    su,
    {
      code: "PRIVATE-CODE",
      name: "Alat Publik",
      category: "Camp",
      total: 7,
      fit: 6,
      condition: "Baik",
      location: "PRIVATE-LOCATION",
      available: false,
      maxDays: 7,
      maxQuantity: 2,
      notes: "PRIVATE-NOTES",
    },
    ctx,
  );
  const state = await m.publicState();
  assert.deepEqual(state.equipment, []);
  assert.equal(state.publicEquipment?.[0].available, false);
  const json = JSON.stringify(state);
  for (const value of ["PRIVATE-CODE", "PRIVATE-LOCATION", "PRIVATE-NOTES"])
    assert.ok(!json.includes(value));
  assert.ok(!("fit" in state.publicEquipment![0]));
});
