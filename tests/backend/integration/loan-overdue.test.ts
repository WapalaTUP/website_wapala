import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../../../src/server/db";
import { clean } from "./helpers";
import { markOverdueLoans } from "../../../src/server/domains/loan-overdue";
beforeEach(clean);
after(() => getDb().$disconnect());
test("overdue job changes only outstanding past-due loans once with atomic history and audit", async () => {
  const db = getDb(),
    base = {
      institution: "Uji",
      pic: "Uji",
      phone: "081234567890",
      phoneDigest: "test",
      email: "uji@example.org",
      start: new Date("2026-10-01"),
      end: new Date("2026-10-13"),
      purpose: "Uji",
      event: "Uji",
      collateral: "KTM",
      originYear: 2026,
      managementYear: 2026,
    };
  await db.loan.createMany({
    data: [
      { ...base, code: "PAST", status: "borrowed" },
      { ...base, code: "DUE", status: "borrowed", end: new Date("2026-10-14") },
      { ...base, code: "DONE", status: "returned" },
      { ...base, code: "ARCHIVE", status: "borrowed", archivedAt: new Date() },
    ],
  });
  const now = new Date("2026-10-14T10:00:00Z");
  assert.equal((await markOverdueLoans(now)).updated, 1);
  assert.equal((await markOverdueLoans(now)).updated, 0);
  assert.equal(
    (await db.loan.findUniqueOrThrow({ where: { code: "PAST" } })).status,
    "late",
  );
  assert.equal(
    (await db.loan.findUniqueOrThrow({ where: { code: "DUE" } })).status,
    "borrowed",
  );
  assert.equal(await db.loanHistory.count(), 1);
  assert.equal(
    await db.auditLog.count({ where: { action: "LOAN_AUTOMATICALLY_LATE" } }),
    1,
  );
});
