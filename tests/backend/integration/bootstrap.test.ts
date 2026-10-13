import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../../../src/server/db";
import { clean, ctx } from "./helpers";
beforeEach(clean);
after(() => getDb().$disconnect());
test("an audit insert failure rolls back both the first account and setup token consumption", async () => {
  const { createBootstrapToken, bootstrap } =
    await import("../../../src/server/auth/bootstrap");
  const token = await createBootstrapToken(ctx);
  await getDb().$executeRawUnsafe(
    `ALTER TABLE "AuditLog" ADD CONSTRAINT audit_test_block CHECK (action <> 'BOOTSTRAP_COMPLETED')`,
  );
  try {
    await assert.rejects(
      bootstrap(
        { token: token.token, password: "test-bootstrap-passphrase" },
        ctx,
      ),
    );
    assert.equal(await getDb().user.count(), 0);
    assert.equal(
      (await getDb().bootstrapState.findUniqueOrThrow({ where: { id: 1 } }))
        .completedAt,
      null,
    );
  } finally {
    await getDb().$executeRawUnsafe(
      'ALTER TABLE "AuditLog" DROP CONSTRAINT audit_test_block',
    );
  }
  await bootstrap(
    { token: token.token, password: "test-bootstrap-passphrase" },
    ctx,
  );
  assert.equal(await getDb().user.count(), 1);
});
test("minimal seed is idempotent and never creates demo users or sessions", async () => {
  const m = await import("../../../src/server/foundation-seed").catch(
    () => null,
  );
  assert.ok(m);
  await m.seedFoundation();
  await m.seedFoundation();
  assert.equal(await getDb().user.count(), 0);
  assert.equal(await getDb().session.count(), 0);
  assert.equal(await getDb().bootstrapState.count(), 1);
  assert.equal(
    (await getDb().siteSettings.findUniqueOrThrow({ where: { id: 1 } }))
      .recruitmentActive,
    false,
  );
});
test("bootstrap race allows exactly one superuser and closes setup permanently", async () => {
  const m = await import("../../../src/server/auth/bootstrap").catch(
    () => null,
  );
  assert.ok(m);
  const token = await m.createBootstrapToken(ctx);
  const input = { token: token.token, password: "test-bootstrap-passphrase" };
  const result = await Promise.allSettled([
    m.bootstrap(input, ctx),
    m.bootstrap(input, ctx),
  ]);
  assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
  const users = await getDb().user.findMany();
  assert.equal(users.length, 1);
  assert.equal(users[0].email, "superuser@wapala.org");
  assert.equal(users[0].recoveryEmail, "Wapalatelkomuniversity@gmail.com");
  await assert.rejects(m.createBootstrapToken(ctx));
  await assert.rejects(m.bootstrap(input, ctx));
  assert.equal(
    await getDb().auditLog.count({ where: { action: "BOOTSTRAP_COMPLETED" } }),
    1,
  );
});
test("expired setup token cannot create a user and audit is append-only", async () => {
  const m = await import("../../../src/server/auth/bootstrap").catch(
    () => null,
  );
  assert.ok(m);
  const token = await m.createBootstrapToken(ctx);
  await getDb().bootstrapState.update({
    where: { id: 1 },
    data: { expiresAt: new Date(0) },
  });
  await assert.rejects(
    m.bootstrap(
      { token: token.token, password: "test-bootstrap-passphrase" },
      ctx,
    ),
  );
  assert.equal(await getDb().user.count(), 0);
  const audit = await getDb().auditLog.findFirstOrThrow();
  await assert.rejects(getDb().auditLog.delete({ where: { id: audit.id } }));
});
