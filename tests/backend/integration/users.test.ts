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
  changePassword,
  resolveSession,
} from "../../../src/server/auth/sessions";
beforeEach(async () => {
  await clean();
  const t = await createBootstrapToken(ctx);
  await bootstrap({ token: t.token, password: "test-admin-passphrase" }, ctx);
});
after(() => getDb().$disconnect());
const users = () => import("../../../src/server/auth/users").catch(() => null);
test("Super User creates real admin identities and temporary passwords require change", async () => {
  const m = await users();
  assert.ok(m);
  const su = await login(
    { email: "superuser@wapala.org", password: "test-admin-passphrase" },
    ctx,
  );
  const account = await m.createAdmin(
    su.principal,
    { email: "POH@wapala.org", name: "POH", role: "POH" },
    ctx,
  );
  assert.equal(account.user.email, "poh@wapala.org");
  assert.ok(!JSON.stringify(account.user).includes("passwordHash"));
  const poh = await login(
    { email: "POH@wapala.org", password: account.temporaryPassword },
    ctx,
  );
  assert.equal(poh.principal.mustChangePassword, true);
  await assert.rejects(
    changePassword(
      poh.principal,
      {
        currentPassword: account.temporaryPassword,
        newPassword: account.temporaryPassword,
      },
      ctx,
    ),
    (e: unknown) =>
      e instanceof Error && "code" in e && e.code === "PASSWORD_UNCHANGED",
  );
  assert.equal((await resolveSession(poh.token))?.mustChangePassword, true);
  await assert.rejects(
    m.createAdmin(
      poh.principal,
      { email: "other@example.org", name: "Other", role: "POH" },
      ctx,
    ),
  );
  await changePassword(
    poh.principal,
    {
      currentPassword: account.temporaryPassword,
      newPassword: "test-poh-new-passphrase",
    },
    ctx,
  );
  assert.equal(await resolveSession(poh.token), null);
});
test("last active Super User cannot be deactivated, including concurrent changes", async () => {
  const m = await users();
  assert.ok(m);
  const su = await login(
    { email: "superuser@wapala.org", password: "test-admin-passphrase" },
    ctx,
  );
  await assert.rejects(
    m.updateAdmin(su.principal, su.principal.userId, { active: false }, ctx),
  );
  const second = await m.createAdmin(
    su.principal,
    { email: "su2@example.org", name: "Second", role: "SUPER_USER" },
    ctx,
  );
  const results = await Promise.allSettled([
    m.updateAdmin(su.principal, su.principal.userId, { active: false }, ctx),
    m.updateAdmin(su.principal, second.user.id, { active: false }, ctx),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    await getDb().user.count({
      where: { role: "SUPER_USER", active: true, archivedAt: null },
    }),
    1,
  );
});
test("resetting an admin password immediately invalidates old sessions", async () => {
  const m = await users();
  assert.ok(m);
  const su = await login(
    { email: "superuser@wapala.org", password: "test-admin-passphrase" },
    ctx,
  );
  const account = await m.createAdmin(
    su.principal,
    { email: "Logistik@wapala.org", name: "Logistik", role: "INVENTARIS" },
    ctx,
  );
  const old = await login(
    { email: account.user.email, password: account.temporaryPassword },
    ctx,
  );
  await m.resetAdminPassword(su.principal, account.user.id, ctx);
  assert.equal(await resolveSession(old.token), null);
  await assert.rejects(
    m.resetAdminPassword(su.principal, su.principal.userId, ctx),
  );
});
