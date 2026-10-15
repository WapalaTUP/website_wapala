import test, { beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { getDb } from "../../../src/server/db";
import { clean, ctx } from "./helpers";
beforeEach(clean);
const initialSetupToken = process.env.INITIAL_SETUP_TOKEN;
beforeEach(() => {
  delete process.env.INITIAL_SETUP_TOKEN;
});
afterEach(() => {
  if (initialSetupToken === undefined) delete process.env.INITIAL_SETUP_TOKEN;
  else process.env.INITIAL_SETUP_TOKEN = initialSetupToken;
});
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

test("environment setup token is registered once without storing its plaintext or extending expiry", async () => {
  const m = await import("../../../src/server/auth/bootstrap");
  process.env.INITIAL_SETUP_TOKEN = randomBytes(32).toString("base64url");
  const started = Date.now();
  assert.equal(await m.setupRequired(), true);
  const state = await getDb().bootstrapState.findUniqueOrThrow({
    where: { id: 1 },
  });
  assert.match(state.tokenHash ?? "", /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(state).includes(process.env.INITIAL_SETUP_TOKEN));
  assert.ok(state.expiresAt!.getTime() >= started + 1_800_000);
  assert.ok(state.expiresAt!.getTime() <= Date.now() + 1_800_000);
  await Promise.all([m.setupRequired(), m.setupRequired()]);
  const repeated = await getDb().bootstrapState.findUniqueOrThrow({
    where: { id: 1 },
  });
  assert.equal(repeated.expiresAt!.getTime(), state.expiresAt!.getTime());
  assert.equal(
    await getDb().auditLog.count({
      where: { action: "BOOTSTRAP_ENV_TOKEN_REGISTERED" },
    }),
    1,
  );
});

test("environment bootstrap works without a prior context request and stays closed after concurrent setup and redeploy", async () => {
  const m = await import("../../../src/server/auth/bootstrap");
  const token = randomBytes(32).toString("base64url");
  process.env.INITIAL_SETUP_TOKEN = token;
  const input = { token, password: "test-environment-passphrase" };
  const results = await Promise.allSettled([
    m.bootstrap(input, ctx),
    m.bootstrap(input, ctx),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(await getDb().user.count(), 1);
  const state = await getDb().bootstrapState.findUniqueOrThrow({
    where: { id: 1 },
  });
  assert.ok(state.completedAt);
  assert.equal(state.tokenHash, null);
  assert.equal(state.expiresAt, null);
  for (const secret of [
    token,
    randomBytes(32).toString("base64url"),
    "invalid",
    undefined,
  ]) {
    if (secret === undefined) delete process.env.INITIAL_SETUP_TOKEN;
    else process.env.INITIAL_SETUP_TOKEN = secret;
    assert.equal(await m.setupRequired(), false);
    await assert.rejects(m.bootstrap(input, ctx));
  }
  assert.equal(await getDb().user.count(), 1);
});

test("expired environment tokens cannot be renewed or reused after rotation", async () => {
  const m = await import("../../../src/server/auth/bootstrap");
  const oldToken = randomBytes(32).toString("base64url");
  process.env.INITIAL_SETUP_TOKEN = oldToken;
  await m.setupRequired();
  await getDb().bootstrapState.update({
    where: { id: 1 },
    data: { expiresAt: new Date(0) },
  });
  await m.setupRequired();
  assert.equal(
    (
      await getDb().bootstrapState.findUniqueOrThrow({ where: { id: 1 } })
    ).expiresAt!.getTime(),
    0,
  );
  await assert.rejects(
    m.bootstrap(
      { token: oldToken, password: "test-environment-passphrase" },
      ctx,
    ),
  );
  process.env.INITIAL_SETUP_TOKEN = randomBytes(32).toString("base64url");
  await m.setupRequired();
  await getDb().bootstrapState.update({
    where: { id: 1 },
    data: { expiresAt: new Date(0) },
  });
  process.env.INITIAL_SETUP_TOKEN = oldToken;
  await assert.rejects(m.setupRequired(), { code: "SETUP_TOKEN_REUSED" });
  assert.equal(await getDb().user.count(), 0);
});

test("an active CLI or environment token cannot be silently replaced by a different deployment secret", async () => {
  const m = await import("../../../src/server/auth/bootstrap");
  const original = await m.createBootstrapToken(ctx);
  process.env.INITIAL_SETUP_TOKEN = randomBytes(32).toString("base64url");
  await assert.rejects(m.setupRequired(), { code: "SETUP_TOKEN_CONFLICT" });
  delete process.env.INITIAL_SETUP_TOKEN;
  await m.bootstrap(
    { token: original.token, password: "test-environment-passphrase" },
    ctx,
  );
  assert.equal(await m.setupRequired(), false);
});

test("invalid environment token fails safely and cannot leak through auth context", async () => {
  const m = await import("../../../src/server/auth/bootstrap");
  const { authGet } = await import("../../../src/server/http/auth-endpoints");
  process.env.INITIAL_SETUP_TOKEN = "private-invalid-token";
  await assert.rejects(
    m.setupRequired(),
    (error: unknown) =>
      error instanceof Error &&
      !error.message.includes("private-invalid-token"),
  );
  process.env.INITIAL_SETUP_TOKEN = randomBytes(32).toString("base64url");
  const response = await authGet(
    new Request("http://127.0.0.1:3107/api/auth/context"),
    "context",
  );
  assert.equal(response.status, 200);
  assert.ok(!(await response.text()).includes(process.env.INITIAL_SETUP_TOKEN));
});

test("environment setup supports the real CSRF-protected setup and login endpoints", async () => {
  const { authGet, authPost } =
    await import("../../../src/server/http/auth-endpoints");
  const token = randomBytes(32).toString("base64url");
  process.env.INITIAL_SETUP_TOKEN = token;
  const origin = "http://127.0.0.1:3107";
  const response = await authGet(
    new Request(origin + "/api/auth/context"),
    "context",
  );
  assert.equal(response.status, 200);
  const context = await response.json();
  assert.equal(context.setupRequired, true);
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  const post = (action: string, body: unknown) =>
    authPost(
      new Request(origin + "/api/auth/" + action, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
          cookie,
          "x-csrf-token": context.csrfToken,
        },
        body: JSON.stringify(body),
      }),
      action,
    );
  const password = "test-environment-passphrase";
  assert.equal(
    (
      await post("bootstrap", {
        token: randomBytes(32).toString("base64url"),
        password,
      })
    ).status,
    400,
  );
  assert.equal(await getDb().user.count(), 0);
  assert.equal((await post("bootstrap", { token, password })).status, 200);
  assert.equal((await post("bootstrap", { token, password })).status, 400);
  const signedIn = await post("login", {
    email: "superuser@wapala.org",
    password,
  });
  assert.equal(signedIn.status, 200);
  assert.match(signedIn.headers.get("set-cookie") ?? "", /HttpOnly/);
  assert.equal(await getDb().session.count(), 1);
});

test("existing Super User closes environment setup even if the completion marker is missing", async () => {
  const m = await import("../../../src/server/auth/bootstrap");
  const token = await m.createBootstrapToken(ctx);
  await m.bootstrap(
    { token: token.token, password: "test-environment-passphrase" },
    ctx,
  );
  await getDb().bootstrapState.update({
    where: { id: 1 },
    data: { completedAt: null },
  });
  process.env.INITIAL_SETUP_TOKEN = randomBytes(32).toString("base64url");
  assert.equal(await m.setupRequired(), false);
  const state = await getDb().bootstrapState.findUniqueOrThrow({
    where: { id: 1 },
  });
  assert.equal(state.tokenHash, null);
  assert.equal(state.expiresAt, null);
});
