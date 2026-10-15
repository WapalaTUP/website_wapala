import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../../../src/server/db";
import { clean, ctx } from "./helpers";
import {
  createBootstrapToken,
  bootstrap,
} from "../../../src/server/auth/bootstrap";
import { login } from "../../../src/server/auth/login";
import type { Principal } from "../../../src/server/auth/policy";
let principal: Principal;
const service = () =>
  import("../../../src/server/domains/events").catch(() => null);
const fixture = () => ({
  title: "Camp Fire",
  description: "Kegiatan bersama",
  cover: "",
  poster: "",
  location: "",
  eventAt: "",
  start: "",
  end: "",
  quota: null,
  form: { title: "Pendaftaran", description: "", items: [] },
});
beforeEach(async () => {
  await clean();
  const setup = await createBootstrapToken(ctx);
  await bootstrap(
    { token: setup.token, password: "event-test-passphrase" },
    ctx,
  );
  principal = (
    await login(
      { email: "superuser@wapala.org", password: "event-test-passphrase" },
      ctx,
    )
  ).principal;
});
after(() => getDb().$disconnect());
test("reconciliation returns an original receipt and fences missing attempts against late commits",async()=>{const m=await service();assert.ok(m);const r=await import("../../../src/server/domains/event-registrations");assert.equal(typeof r.reconcileEventRegistration,"function","Replay reconciliation exists");const d=await m.saveEvent(principal,fixture(),ctx),p=await m.publishEvent(principal,{id:d.id,version:d.version},ctx);const input={eventId:p.id,revisionId:p.publishedRevisionId!,idempotencyKey:randomUUID(),answers:{}};assert.equal((await r.reconcileEventRegistration(input,"owner")).code,null);await assert.rejects(r.submitEventRegistration(input,"owner",ctx),{code:"ATTEMPT_CLOSED"});const other={...input,idempotencyKey:randomUUID()};const receipt=await r.submitEventRegistration(other,"owner",ctx);assert.equal((await r.reconcileEventRegistration(other,"owner")).code,receipt.code);});
test("event draft publication preserves revisions and denies unauthorized management", async () => {
  const m = await service();
  assert.ok(m, "Event service exists");
  const d = await m.saveEvent(principal, fixture(), ctx);
  assert.equal((await m.publicEvents()).length, 0);
  const p = await m.publishEvent(
    principal,
    { id: d.id, version: d.version },
    ctx,
  );
  assert.ok(p.publishedRevisionId);
  const edit = await m.saveEvent(
    principal,
    { ...fixture(), title: "Belum publik", id: p.id, version: p.version },
    ctx,
  );
  assert.equal((await m.publicEvent(p.id)).title, "Camp Fire");
  await assert.rejects(
    m.saveEvent(principal, { ...fixture(), id: p.id, version: p.version }, ctx),
    { code: "CONFLICT" },
  );
  const p2 = await m.publishEvent(
    principal,
    { id: edit.id, version: edit.version },
    ctx,
  );
  assert.notEqual(p2.publishedRevisionId, p.publishedRevisionId);
  assert.equal(await getDb().eventFormRevision.count(), 2);
  await assert.rejects(m.listEvents({ ...principal, role: "POH" }), {
    code: "FORBIDDEN",
  });
});
test("event submissions accept all optional fields and reserve quota atomically with idempotent replay", async () => {
  const m = await service();
  assert.ok(m);
  const r = await import("../../../src/server/domains/event-registrations");
  const d = await m.saveEvent(principal, { ...fixture(), quota: 1 }, ctx);
  const p = await m.publishEvent(
    principal,
    { id: d.id, version: d.version },
    ctx,
  );
  const input = {
    eventId: p.id,
    revisionId: p.publishedRevisionId!,
    idempotencyKey: randomUUID(),
    answers: {},
  };
  const results = await Promise.allSettled([
    r.submitEventRegistration(input, "owner1", ctx),
    r.submitEventRegistration(
      { ...input, idempotencyKey: randomUUID() },
      "owner2",
      ctx,
    ),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(await getDb().eventRegistration.count(), 1);
  const success = results.findIndex((x) => x.status === "fulfilled");
  if (success === 0) {
    const replay = await r.submitEventRegistration(input, "owner1", ctx);
    assert.equal(
      replay.code,
      (results[0] as PromiseFulfilledResult<{ code: string }>).value.code,
    );
  }
  await assert.rejects(
    r.listEventRegistrations({ ...principal, role: "INVENTARIS" }, p.id, {}),
    { code: "FORBIDDEN" },
  );
});
test("event revision conflicts and historical labels remain isolated by event", async () => {
  const m = await service();
  assert.ok(m);
  const r = await import("../../../src/server/domains/event-registrations");
  const f = fixture();
  const question = {
    id: randomUUID(),
    kind: "shortText",
    title: "NIM",
    help: "",
    required: false,
    options: [],
    gridRows: [],
    validation: {},
    other: false,
  };
  const d = await m.saveEvent(
    principal,
    { ...f, form: { ...f.form, items: [question] } },
    ctx,
  );
  const p = await m.publishEvent(
    principal,
    { id: d.id, version: d.version },
    ctx,
  );
  const input = {
    eventId: p.id,
    revisionId: p.publishedRevisionId!,
    idempotencyKey: randomUUID(),
    answers: { [question.id]: "00123" },
  };
  await r.submitEventRegistration(input, "owner", ctx);
  const d2 = await m.saveEvent(
    principal,
    { ...f, id: p.id, version: p.version },
    ctx,
  );
  await m.publishEvent(principal, { id: d2.id, version: d2.version }, ctx);
  await assert.rejects(
    r.submitEventRegistration(
      { ...input, idempotencyKey: randomUUID() },
      "owner",
      ctx,
    ),
    { code: "FORM_CHANGED" },
  );
  const rows = await r.listEventRegistrations(principal, p.id, {});
  assert.equal(rows.rows[0].form.items[0].title, "NIM");
  assert.equal(rows.rows[0].answers[question.id], "00123");
  assert.equal(
    (await r.listEventRegistrations(principal, p.id, { query: "00123" })).total,
    1,
  );
  assert.equal(
    (await r.listEventRegistrations(principal, p.id, { query: "tidak-ada" }))
      .total,
    0,
  );
  const other = await m.saveEvent(principal, fixture(), ctx);
  assert.equal(
    (await r.listEventRegistrations(principal, other.id, {})).rows.length,
    0,
  );
});
