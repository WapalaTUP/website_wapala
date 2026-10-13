import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../../../src/server/db";
import { clean } from "./helpers";
beforeEach(clean);
after(() => getDb().$disconnect());
test("least-privilege database role cannot truncate or modify the audit table", async () => {
  const db = getDb(),
    schema = new URL(process.env.DATABASE_URL!).searchParams.get("schema")!;
  assert.match(schema, /^wapala_test_[a-f0-9]{32}$/);
  const role = "wapala_test_role_" + randomUUID().replaceAll("-", "");
  await db.$executeRawUnsafe(`CREATE ROLE "${role}" NOLOGIN`);
  try {
    await db.$executeRawUnsafe(
      `GRANT USAGE ON SCHEMA "${schema}" TO "${role}"`,
    );
    await db.$executeRawUnsafe(
      `GRANT SELECT, INSERT ON TABLE "${schema}"."AuditLog" TO "${role}"`,
    );
    await assert.rejects(
      db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${role}"`);
        await tx.$executeRawUnsafe('TRUNCATE "AuditLog"');
      }),
    );
    await assert.rejects(
      db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${role}"`);
        await tx.$executeRawUnsafe('DELETE FROM "AuditLog"');
      }),
    );
  } finally {
    await db.$executeRawUnsafe(`DROP OWNED BY "${role}"`);
    await db.$executeRawUnsafe(`DROP ROLE "${role}"`);
  }
});
