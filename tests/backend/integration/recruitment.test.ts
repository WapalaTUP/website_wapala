import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../../../src/server/db";
import { clean, ctx } from "./helpers";
import {
  createBootstrapToken,
  bootstrap,
} from "../../../src/server/auth/bootstrap";
import { login } from "../../../src/server/auth/login";
import { createAdmin } from "../../../src/server/auth/users";
import { changePassword } from "../../../src/server/auth/sessions";
import type { Principal } from "../../../src/server/auth/policy";
let su: Principal;
const service = () =>
  import("../../../src/server/domains/recruitment").catch(() => null);
beforeEach(async () => {
  await clean();
  const t = await createBootstrapToken(ctx);
  await bootstrap(
    { token: t.token, password: "recruitment-test-passphrase" },
    ctx,
  );
  su = (
    await login(
      {
        email: "superuser@wapala.org",
        password: "recruitment-test-passphrase",
      },
      ctx,
    )
  ).principal;
});
after(() => getDb().$disconnect());
test("recruitment is annual and concurrent activation leaves one active period", async () => {
  const m = await service();
  assert.ok(m);
  await m.setRecruitmentPeriod(su, 2026, true, ctx);
  await m.setRecruitmentPeriod(su, 2026, false, ctx);
  await m.setRecruitmentPeriod(su, 2026, true, ctx);
  assert.equal((await m.listPeriods(su)).length, 1);
  await Promise.all([
    m.setRecruitmentPeriod(su, 2027, true, ctx),
    m.setRecruitmentPeriod(su, 2028, true, ctx),
  ]);
  assert.equal((await m.listPeriods(su)).filter((p) => p.active).length, 1);
});
test("every admin reads recruitment but POH cannot open periods", async () => {
  const m = await service();
  assert.ok(m);
  const a = await createAdmin(
    su,
    { email: "poh@example.org", name: "POH", role: "POH" },
    ctx,
  );
  let s = await login(
    { email: a.user.email, password: a.temporaryPassword },
    ctx,
  );
  await changePassword(
    s.principal,
    {
      currentPassword: a.temporaryPassword,
      newPassword: "changed-poh-passphrase",
    },
    ctx,
  );
  s = await login(
    { email: a.user.email, password: "changed-poh-passphrase" },
    ctx,
  );
  assert.deepEqual(await m.listApplicants(s.principal, 2026), []);
  await assert.rejects(m.setRecruitmentPeriod(s.principal, 2026, true, ctx));
});
test("closed annual period rejects registrations and duplicate NIM is rejected within a year", async () => {
  const m = await service();
  assert.ok(m);
  const fields = {
    nama: "Peserta Uji",
    nim: "001234",
    prodi: "Informatika",
    telepon: "081234567890",
    email: "uji@example.org",
    tempat_lahir: "Kota Uji",
    tanggal_lahir: "2005-01-01",
    jenis_kelamin: "Laki-laki",
    golongan_darah: "O",
    agama: "Lainnya",
    alamat_rumah: "Alamat uji",
    alamat_domisili: "Domisili uji",
    nama_orangtua: "Orang Tua",
    telepon_orangtua: "081234567891",
    motivasi: "Belajar kegiatan alam",
    pengalaman_organisasi: "",
    riwayat_penyakit: "",
  };
  await assert.rejects(
    m.submitApplicant({ year: 2026, fields, photo: "" }, ctx),
  );
  await m.setRecruitmentPeriod(su, 2026, true, ctx);
  const receipt = await m.submitApplicant(
    { year: 2026, fields, photo: "" },
    ctx,
  );
  assert.match(receipt.code, /^OR2026-/);
  await assert.rejects(
    m.submitApplicant({ year: 2026, fields, photo: "" }, ctx),
  );
  const rows = await m.listApplicants(su, 2026);
  assert.equal(rows[0].fields.nim, "001234");
  assert.ok(!("phoneDigest" in rows[0]));
  const { exportApplicants } =
    await import("../../../src/server/domains/operational-export");
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(
    (await exportApplicants(su, 2026, "xlsx")) as unknown as Parameters<
      typeof wb.xlsx.load
    >[0],
  );
  assert.equal(wb.worksheets[0].getCell("D2").value, "001234");
  assert.equal(
    (await exportApplicants(su, 2026, "pdf")).subarray(0, 5).toString(),
    "%PDF-",
  );
  await getDb().user.update({
    where: { id: su.userId },
    data: { active: false },
  });
  await assert.rejects(exportApplicants(su, 2026, "xlsx"));
});
