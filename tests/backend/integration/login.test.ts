import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../../../src/server/db";
import { clean, ctx } from "./helpers";
import {
  createBootstrapToken,
  bootstrap,
} from "../../../src/server/auth/bootstrap";
beforeEach(async () => {
  await clean();
  const t = await createBootstrapToken(ctx);
  await bootstrap({ token: t.token, password: "test-login-passphrase" }, ctx);
});
after(() => getDb().$disconnect());
const loginModule = () =>
  import("../../../src/server/auth/login").catch(() => null);
test("expired sessions cannot authorize even while the user remains active", async () => {
  const { login } = await import("../../../src/server/auth/login"),
    { resolveSession } = await import("../../../src/server/auth/sessions");
  const result = await login(
    { email: "superuser@wapala.org", password: "test-login-passphrase" },
    ctx,
  );
  await getDb().session.update({
    where: { id: result.principal.sessionId },
    data: { createdAt: new Date(0), expiresAt: new Date(1000) },
  });
  assert.equal(await resolveSession(result.token), null);
});
test("database login issues opaque sessions and logout revokes them", async () => {
  const m = await loginModule();
  const s = await import("../../../src/server/auth/sessions").catch(() => null);
  assert.ok(m && s);
  const login = await m.login(
    { email: "SUPERUSER@WAPALA.ORG", password: "test-login-passphrase" },
    ctx,
  );
  assert.equal(login.principal.role, "SUPER_USER");
  assert.equal(
    (await s.resolveSession(login.token))?.userId,
    login.principal.userId,
  );
  assert.ok(login.expiresAt.getTime() <= Date.now() + 30 * 86400000);
  const stored = await getDb().session.findFirstOrThrow();
  assert.notEqual(stored.tokenHash, login.token);
  await s.logout(login.token, ctx);
  assert.equal(await s.resolveSession(login.token), null);
});
test("login locks after three failures and escalates the next three after lock expiry", async () => {
  const m = await loginModule();
  assert.ok(m);
  const input = { email: "superuser@wapala.org", password: "wrong-password" };
  for (let i = 0; i < 3; i++) await assert.rejects(m.login(input, ctx));
  const user = await getDb().user.findFirstOrThrow();
  assert.ok(user.lockUntil && user.lockUntil > new Date());
  assert.equal(user.failedLoginCount, 3);
  await getDb().user.update({
    where: { id: user.id },
    data: { lockUntil: new Date(0) },
  });
  for (let i = 0; i < 3; i++) await assert.rejects(m.login(input, ctx));
  assert.equal((await getDb().user.findFirstOrThrow()).requiresUnlock, true);
  await assert.rejects(
    m.login({ email: input.email, password: "test-login-passphrase" }, ctx),
  );
});
test("password change revokes every session and inactive/expired users cannot resolve sessions", async () => {
  const m = await loginModule(),
    s = await import("../../../src/server/auth/sessions").catch(() => null);
  assert.ok(m && s);
  const a = await m.login(
      { email: "superuser@wapala.org", password: "test-login-passphrase" },
      ctx,
    ),
    b = await m.login(
      { email: "superuser@wapala.org", password: "test-login-passphrase" },
      ctx,
    );
  await s.changePassword(
    a.principal,
    {
      currentPassword: "test-login-passphrase",
      newPassword: "test-changed-passphrase",
    },
    ctx,
  );
  assert.equal(await s.resolveSession(a.token), null);
  assert.equal(await s.resolveSession(b.token), null);
  const c = await m.login(
    { email: "superuser@wapala.org", password: "test-changed-passphrase" },
    ctx,
  );
  await getDb().user.update({
    where: { id: c.principal.userId },
    data: { active: false },
  });
  assert.equal(await s.resolveSession(c.token), null);
});
test("unknown and SQL injection email failures use the same public error as wrong passwords", async () => {
  const m = await loginModule();
  assert.ok(m);
  const errors: string[] = [];
  for (const email of [
    "unknown@example.org",
    "' OR 1=1 --",
    "superuser@wapala.org",
  ])
    try {
      await m.login({ email, password: "wrong-passphrase" }, ctx);
    } catch (e) {
      errors.push((e as Error).message);
    }
  assert.equal(new Set(errors).size, 1);
  assert.equal(await getDb().session.count(), 0);
});
