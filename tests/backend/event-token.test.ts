import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
test("event capability binds event revision owner and expiry and rejects tampering", async () => {
  const m = await import("../../src/server/security/event-form-token").catch(
    () => null,
  );
  assert.ok(m, "Event capability exists");
  const key = randomBytes(32),
    eventId = randomUUID(),
    revisionId = randomUUID(),
    now = 1000000;
  const token = m.issueEventFormToken(eventId, revisionId, { key, now });
  const payload = m.verifyEventFormToken(token, { key, now });
  assert.equal(payload.eventId, eventId);
  assert.equal(payload.revisionId, revisionId);
  assert.ok(payload.ownerDigest);
  assert.throws(() => m.verifyEventFormToken(token + "x", { key, now }));
  assert.throws(() =>
    m.verifyEventFormToken(token, { key, now: now + 7200001 }),
  );
  assert.equal(
    m.verifyEventReplayToken(token, { key, now: now + 7200001 }).ownerDigest,
    payload.ownerDigest,
  );
  assert.throws(() =>
    m.verifyEventReplayToken(token, { key, now: now + 7200000 + 86400001 }),
  );
});
