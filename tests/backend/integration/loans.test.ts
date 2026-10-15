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
const inventory = () =>
  import("../../../src/server/domains/inventory").catch(() => null);
const loans = () =>
  import("../../../src/server/domains/loans").catch(() => null);
export const equipmentFixture = (code = "EQ001") => ({
  code,
  name: "Tenda Uji",
  category: "Camp",
  brand: "Merek",
  typeColor: "Hijau",
  source: "Pembelian",
  yearEntered: "2026",
  photo: "",
  total: 2,
  fit: 2,
  condition: "Baik" as const,
  location: "Sekretariat",
  available: true,
  maxDays: 30,
  maxQuantity: 2,
  notes: "",
});
export const loanFixture = (
  equipmentId: string,
  start = "2030-01-01",
  end = "2030-01-05",
) => ({
  institution: "Lembaga Uji",
  pic: "PIC Uji",
  phone: "081234567890",
  email: "pic@example.org",
  start,
  end,
  purpose: "Latihan",
  event: "Kegiatan Uji",
  collateral: "KTM",
  items: [{ equipmentId, requested: 2 }],
});
beforeEach(async () => {
  await clean();
  const t = await createBootstrapToken(ctx);
  await bootstrap({ token: t.token, password: "loan-test-passphrase" }, ctx);
  su = (
    await login(
      { email: "superuser@wapala.org", password: "loan-test-passphrase" },
      ctx,
    )
  ).principal;
});
after(() => getDb().$disconnect());
test("concurrent approvals never reserve more fit equipment than exists", async () => {
  const i = await inventory(),
    m = await loans();
  assert.ok(i);
  assert.ok(m);
  const eq = await i.saveEquipment(su, equipmentFixture(), ctx);
  const a = await m.requestLoan(loanFixture(eq.id), ctx),
    b = await m.requestLoan(loanFixture(eq.id), ctx);
  const results = await Promise.allSettled([
    m.transitionLoan(
      su,
      a.id,
      {
        status: "approved",
        items: [{ equipmentId: eq.id, approved: 2, reason: "" }],
        note: "",
      },
      ctx,
    ),
    m.transitionLoan(
      su,
      b.id,
      {
        status: "approved",
        items: [{ equipmentId: eq.id, approved: 2, reason: "" }],
        note: "",
      },
      ctx,
    ),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (await m.listLoans(su)).filter((l) => l.status === "approved").length,
    1,
  );
});
test("date capacity uses peak simultaneous reservations rather than sum of disjoint intervals", async () => {
  const i = await inventory(),
    m = await loans();
  assert.ok(i);
  assert.ok(m);
  const eq = await i.saveEquipment(su, equipmentFixture(), ctx);
  const a = await m.requestLoan(
    {
      ...loanFixture(eq.id, "2030-01-01", "2030-01-02"),
      items: [{ equipmentId: eq.id, requested: 1 }],
    },
    ctx,
  );
  const b = await m.requestLoan(
    {
      ...loanFixture(eq.id, "2030-01-03", "2030-01-04"),
      items: [{ equipmentId: eq.id, requested: 1 }],
    },
    ctx,
  );
  const approve = (id: string, approved: number) =>
    m.transitionLoan(
      su,
      id,
      {
        status: "approved",
        items: [{ equipmentId: eq.id, approved, reason: "" }],
        note: "",
      },
      ctx,
    );
  await approve(a.id, 1);
  await approve(b.id, 1);
  const c = await m.requestLoan(
    {
      ...loanFixture(eq.id, "2030-01-01", "2030-01-04"),
      items: [{ equipmentId: eq.id, requested: 1 }],
    },
    ctx,
  );
  await approve(c.id, 1);
  assert.equal(
    (await m.listLoans(su)).filter((l) => l.status === "approved").length,
    3,
  );
  await assert.rejects(i.saveEquipment(su, { ...eq, fit: 1 }, ctx));
});
test("only verified return releases reservation and invalid state transitions are rejected", async () => {
  const i = await inventory(),
    m = await loans();
  assert.ok(i);
  assert.ok(m);
  const eq = await i.saveEquipment(su, equipmentFixture(), ctx),
    a = await m.requestLoan(loanFixture(eq.id), ctx);
  await assert.rejects(
    m.transitionLoan(su, a.id, { status: "returned", note: "" }, ctx),
  );
  await m.transitionLoan(
    su,
    a.id,
    {
      status: "approved",
      items: [{ equipmentId: eq.id, approved: 2, reason: "" }],
      note: "",
    },
    ctx,
  );
  await m.transitionLoan(
    su,
    a.id,
    { status: "borrowed", note: "Alat diserahkan" },
    ctx,
  );
  await m.transitionLoan(
    su,
    a.id,
    { status: "awaiting_return", note: "Menunggu pemeriksaan" },
    ctx,
  );
  const b = await m.requestLoan(loanFixture(eq.id), ctx);
  await assert.rejects(
    m.transitionLoan(
      su,
      b.id,
      {
        status: "approved",
        items: [{ equipmentId: eq.id, approved: 2, reason: "" }],
        note: "",
      },
      ctx,
    ),
  );
  await m.transitionLoan(
    su,
    a.id,
    {
      status: "returned",
      note: "Kondisi diperiksa",
      returns: [{ equipmentId: eq.id, condition: "Baik" }],
    },
    ctx,
  );
  await m.transitionLoan(
    su,
    b.id,
    {
      status: "approved",
      items: [{ equipmentId: eq.id, approved: 2, reason: "" }],
      note: "",
    },
    ctx,
  );
  assert.equal(
    (await m.listLoans(su)).find((l) => l.id === a.id)?.status,
    "returned",
  );
});
test("inventory batch import is atomic and rejects duplicate equipment codes", async () => {
  const i = await inventory();
  assert.ok(i);
  await i.importEquipment(su, [equipmentFixture("0001")], ctx);
  await assert.rejects(
    i.importEquipment(
      su,
      [equipmentFixture("0002"), equipmentFixture("0001")],
      ctx,
    ),
  );
  const rows = await i.listEquipment(su);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].code, "0001");
  assert.equal(rows[0].fit, 2);
});
