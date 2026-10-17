/** Run on the VPS against a dedicated *_test database, never the shared live DB. */
import { readFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { Client } from "pg";
import { parse } from "dotenv";
import assert from "node:assert/strict";
import { getDb } from "../src/server/db";
import { validateTestDatabaseUrl } from "../src/server/config";
import { hashPassword } from "../src/server/security/password";
import { digestToken } from "../src/server/security/tokens";
import { previewDataReset, resetData } from "../src/server/domains/data-reset";
import { loanItemsForHistory } from "../src/server/domains/loan-history-items";
import type { Principal } from "../src/server/auth/policy";

async function main() {
  const local = parse(await readFile(".local/backend.env"));
  const base = new URL(local.DATABASE_URL);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(base.hostname))
    throw new Error("Local PostgreSQL only");
  const url = new URL(base);
  url.pathname = "/wapala_delete_test";
  url.search = "";
  validateTestDatabaseUrl(url.href, base.href);
  const admin = new Client({ connectionString: base.href });
  await admin.connect();
  try {
    if (
      !(await admin.query("SELECT 1 FROM pg_database WHERE datname='wapala_delete_test'")).rowCount
    )
      await admin.query("CREATE DATABASE wapala_delete_test");
  } finally {
    await admin.end();
  }
  const schema = "delete_" + randomBytes(6).toString("hex");
  url.searchParams.set("schema", schema);
  process.env.DATABASE_URL = url.href;
  process.env.APP_URL = "http://127.0.0.1:3100";
  process.env.SECURITY_KEY = randomBytes(32).toString("base64");
  process.env.EMAIL_MODE = "disabled";
  process.env.MEDIA_ROOT = process.cwd() + "/.local/delete-test-media";
  const migrated = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { env: process.env, encoding: "utf8" },
  );
  if (migrated.status !== 0) throw new Error("Test migration failed");
  const db = getDb();
  const password = randomBytes(24).toString("hex");
  const passwordHash = await hashPassword(password);
  const ctx = { ipDigest: "test", userAgent: "delete-integration", requestId: randomUUID() };
  const user = await db.user.create({
    data: {
      name: "Super",
      email: "super@local.test",
      role: "SUPER_USER",
      passwordHash,
      mustChangePassword: false,
    },
  });
  const session = await db.session.create({
    data: {
      userId: user.id,
      tokenHash: digestToken(randomUUID()),
      csrfDigest: "test",
      credentialVersion: 0,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const p: Principal = {
    userId: user.id,
    sessionId: session.id,
    role: "SUPER_USER",
    mustChangePassword: false,
  };
  const rejected = (code: string) => (e: unknown) =>
    !!e && typeof e === "object" && "code" in e && e.code === code;
  async function remove(target: "members" | "inventory" | "users", id: string) {
    const preview = await previewDataReset(p, { target, id, mode: "delete" });
    assert.equal(preview.count, 1);
    assert.equal(preview.blocked, 0);
    return resetData(
      p,
      {
        target,
        id,
        mode: "delete",
        snapshot: preview.snapshot,
        confirmation: preview.confirmation,
        password,
      },
      ctx,
    );
  }
  try {
    await assert.rejects(
      () =>
        previewDataReset(
          { ...p, role: "POH" },
          { target: "members", id: randomUUID(), mode: "delete" },
        ),
      rejected("FORBIDDEN"),
    );
    await assert.rejects(
      () => previewDataReset(p, { target: "users", mode: "delete" }),
      rejected("INVALID_INPUT"),
    );
    assert.equal(
      (await previewDataReset(p, { target: "users", id: user.id, mode: "delete" })).blocked,
      1,
    );
    const member = await db.member.create({ data: { nia: "test-one", fields: { nama: "One" } } });
    const untouched = await db.member.create({
      data: { nia: "test-other", fields: { nama: "Other" } },
    });
    const linked = await db.user.create({
      data: {
        name: "Linked",
        email: "linked@local.test",
        role: "ANGGOTA",
        memberId: member.id,
        passwordHash,
      },
    });
    await db.session.create({
      data: {
        userId: linked.id,
        tokenHash: digestToken(randomUUID()),
        csrfDigest: "test",
        credentialVersion: 0,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    await db.passwordResetToken.create({
      data: {
        userId: linked.id,
        tokenHash: digestToken(randomUUID()),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    assert.equal(
      (await previewDataReset(p, { target: "members", id: member.id, mode: "delete" })).blocked,
      1,
    );
    await remove("users", linked.id);
    assert.equal(await db.user.count({ where: { id: linked.id } }), 0);
    assert.equal(await db.session.count({ where: { userId: linked.id } }), 0);
    assert.equal(await db.passwordResetToken.count({ where: { userId: linked.id } }), 0);
    assert.equal(await db.member.count({ where: { id: member.id } }), 1);
    await remove("members", member.id);
    assert.equal(await db.member.count({ where: { id: untouched.id } }), 1);
    const stale = await previewDataReset(p, {
      target: "members",
      id: untouched.id,
      mode: "delete",
    });
    await db.member.update({ where: { id: untouched.id }, data: { version: { increment: 1 } } });
    await assert.rejects(
      () =>
        resetData(
          p,
          {
            target: "members",
            id: untouched.id,
            mode: "delete",
            snapshot: stale.snapshot,
            confirmation: stale.confirmation,
            password,
          },
          ctx,
        ),
      rejected("CONFLICT"),
    );
    const eq = (code: string) =>
      db.equipment.create({
        data: {
          code,
          name: "Carabiner",
          category: "Panjat",
          typeColor: "Screw",
          total: 5,
          fit: 5,
          condition: "Baik",
          location: "Gudang",
        },
      });
    const first = await eq("EQ-1"),
      second = await eq("EQ-2");
    const loan = await db.loan.create({
      data: {
        code: "TEST-RETURNED",
        institution: "Test",
        pic: "Test",
        phone: "08123456789",
        phoneDigest: "test",
        email: "test@local.test",
        start: new Date("2026-10-18"),
        end: new Date("2026-10-19"),
        purpose: "Test",
        event: "Test",
        collateral: "Test",
        originYear: 2026,
        managementYear: 2026,
        status: "borrowed",
        items: {
          create: [
            { equipmentId: first.id, requested: 1, approved: 1 },
            { equipmentId: second.id, requested: 1, approved: 1 },
          ],
        },
      },
    });
    assert.equal(
      (await previewDataReset(p, { target: "inventory", id: first.id, mode: "delete" })).blocked,
      1,
    );
    await db.loan.update({ where: { id: loan.id }, data: { status: "returned" } });
    await remove("inventory", first.id);
    assert.equal(await db.equipment.count({ where: { id: first.id } }), 0);
    assert.equal(await db.equipment.count({ where: { id: second.id } }), 1);
    const remaining = await db.loan.findUniqueOrThrow({
      where: { id: loan.id },
      include: { items: { include: { equipment: true } } },
    });
    assert.equal(remaining.items.length, 1);
    assert.equal(remaining.items[0].equipmentId, second.id);
    const history = loanItemsForHistory(remaining);
    assert.equal(history.length, 2);
    assert.equal(history.find((i) => i.equipmentId === first.id)?.code, "EQ-1");
    console.log(
      "PASS: permissions, self-delete protection, linked-member block, session/token cleanup, selected-only deletion, stale preview, active loan block, invoice history preservation",
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error("Deletion integration failed; inspect the isolated test database.");
  process.exitCode = 1;
});
