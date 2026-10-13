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
import { resolveSession } from "../../../src/server/auth/sessions";
import { saveEquipment } from "../../../src/server/domains/inventory";
import {
  requestLoan,
  transitionLoan,
  listLoans,
} from "../../../src/server/domains/loans";
import {
  setRecruitmentPeriod,
  listPeriods,
} from "../../../src/server/domains/recruitment";
import type { Principal } from "../../../src/server/auth/policy";
let su: Principal;
const service = () =>
  import("../../../src/server/domains/management").catch(() => null);
beforeEach(async () => {
  await clean();
  const t = await createBootstrapToken(ctx);
  await bootstrap(
    { token: t.token, password: "management-test-passphrase" },
    ctx,
  );
  su = (
    await login(
      { email: "superuser@wapala.org", password: "management-test-passphrase" },
      ctx,
    )
  ).principal;
});
after(() => getDb().$disconnect());
test("rollover archives terminal loans but retains active reservations and annual recruitment", async () => {
  const m = await service();
  assert.ok(m);
  const eq = await saveEquipment(
    su,
    {
      code: "EQ001",
      name: "Tenda",
      category: "Camp",
      total: 2,
      fit: 2,
      condition: "Baik",
      location: "Sekretariat",
      available: true,
      maxDays: 7,
      maxQuantity: 2,
      notes: "",
    },
    ctx,
  );
  const input = {
    institution: "Lembaga",
    pic: "PIC",
    phone: "081234567890",
    email: "pic@example.org",
    start: "2030-01-01",
    end: "2030-01-05",
    purpose: "Latihan",
    event: "Latihan",
    collateral: "KTM",
    items: [{ equipmentId: eq.id, requested: 2 }],
  };
  const active = await requestLoan(input, ctx),
    rejected = await requestLoan(input, ctx);
  await transitionLoan(
    su,
    active.id,
    {
      status: "approved",
      items: [{ equipmentId: eq.id, approved: 2, reason: "" }],
      note: "",
    },
    ctx,
  );
  await transitionLoan(
    su,
    rejected.id,
    { status: "rejected", note: "Kegiatan dibatalkan" },
    ctx,
  );
  await setRecruitmentPeriod(su, 2026, true, ctx);
  const result = await m.rollover(
    su,
    { expectedYear: 2026, year: 2027, passwordChoices: [] },
    ctx,
  );
  assert.equal(result.archived, 1);
  assert.equal(result.carried, 1);
  const rows = await listLoans(su);
  assert.equal(rows.find((l) => l.id === active.id)?.managementYear, 2027);
  assert.equal(rows.find((l) => l.id === active.id)?.originYear, 2026);
  assert.equal(rows.find((l) => l.id === rejected.id)?.archived, true);
  assert.equal((await listPeriods(su))[0].active, true);
  const next = await requestLoan(input, ctx);
  await assert.rejects(
    transitionLoan(
      su,
      next.id,
      {
        status: "approved",
        items: [{ equipmentId: eq.id, approved: 2, reason: "" }],
        note: "",
      },
      ctx,
    ),
  );
});
test("rollover resets only selected admins and cannot reset SuperUser through admin choices", async () => {
  const m = await service();
  assert.ok(m);
  const a = await createAdmin(
    su,
    { email: "POH@wapala.org", name: "POH", role: "POH" },
    ctx,
  );
  const b = await createAdmin(
    su,
    { email: "Logistik@wapala.org", name: "Logistik", role: "INVENTARIS" },
    ctx,
  );
  const sa = await login(
      { email: a.user.email, password: a.temporaryPassword },
      ctx,
    ),
    sb = await login(
      { email: b.user.email, password: b.temporaryPassword },
      ctx,
    );
  await assert.rejects(
    m.rollover(
      su,
      {
        expectedYear: 2026,
        year: 2027,
        passwordChoices: [{ userId: su.userId, reset: true }],
      },
      ctx,
    ),
  );
  assert.equal(
    (await getDb().siteSettings.findUniqueOrThrow({ where: { id: 1 } }))
      .managementYear,
    2026,
  );
  const result = await m.rollover(
    su,
    {
      expectedYear: 2026,
      year: 2027,
      passwordChoices: [
        { userId: a.user.id, reset: true },
        { userId: b.user.id, reset: false },
      ],
    },
    ctx,
  );
  assert.equal(await resolveSession(sa.token), null);
  assert.ok(await resolveSession(sb.token));
  assert.equal(result.credentials.length, 1);
  assert.equal(result.credentials[0].email, "poh@wapala.org");
  assert.equal(
    (
      await login(
        {
          email: a.user.email,
          password: result.credentials[0].temporaryPassword,
        },
        ctx,
      )
    ).principal.mustChangePassword,
    true,
  );
});
