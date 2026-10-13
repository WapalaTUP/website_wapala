import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { clean, ctx } from "./helpers";
import { getDb } from "../../../src/server/db";
import {
  createBootstrapToken,
  bootstrap,
} from "../../../src/server/auth/bootstrap";
import { login } from "../../../src/server/auth/login";
beforeEach(clean);
after(() => getDb().$disconnect());
test("event participant files reject malware and foreign ownership and remain private", async () => {
  const m = await import("../../../src/server/media/event-upload").catch(
    () => null,
  );
  assert.ok(m, "Anonymous event upload exists");
  const { saveEvent, publishEvent } =
    await import("../../../src/server/domains/events");
  const { submitEventRegistration } =
    await import("../../../src/server/domains/event-registrations");
  const { issueEventFormToken, verifyEventFormToken } =
    await import("../../../src/server/security/event-form-token");
  const setup = await createBootstrapToken(ctx);
  await bootstrap(
    { token: setup.token, password: "event-media-test-password" },
    ctx,
  );
  const p = (
    await login(
      { email: "superuser@wapala.org", password: "event-media-test-password" },
      ctx,
    )
  ).principal;
  const q = {
    id: randomUUID(),
    kind: "upload",
    title: "Dokumen",
    help: "",
    required: false,
    options: [],
    gridRows: [],
  };
  const d = await saveEvent(
    p,
    {
      title: "Files",
      description: "",
      cover: "",
      poster: "",
      location: "",
      eventAt: "",
      start: "",
      end: "",
      quota: null,
      form: { title: "Files", description: "", items: [q] },
    },
    ctx,
  );
  const e = await publishEvent(p, { id: d.id, version: d.version }, ctx);
  const token = issueEventFormToken(e.id, e.publishedRevisionId!),
    owner = verifyEventFormToken(token).ownerDigest;
  const root = await mkdtemp(join(tmpdir(), "wapala-event-media-")),
    bytes = await sharp({
      create: { width: 10, height: 10, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
  try {
    await assert.rejects(
      m.registerEventUpload(
        { token, questionId: q.id, bytes, mime: "image/png" },
        ctx,
        { root, scan: async () => 1 },
      ),
      { code: "MALWARE_DETECTED" },
    );
    assert.equal(await getDb().media.count(), 0);
    const file = await m.registerEventUpload(
      { token, questionId: q.id, bytes, mime: "image/png" },
      ctx,
      { root, scan: async () => 0 },
    );
    assert.equal(
      (await getDb().media.findUniqueOrThrow({ where: { id: file.id } }))
        .visibility,
      "private",
    );
    const input = {
      eventId: e.id,
      revisionId: e.publishedRevisionId!,
      idempotencyKey: randomUUID(),
      answers: { [q.id]: file.id },
    };
    await assert.rejects(submitEventRegistration(input, "foreign", ctx), {
      code: "INVALID_MEDIA",
    });
    await submitEventRegistration(input, owner, ctx);
    const unused = await m.registerEventUpload(
      { token, questionId: q.id, bytes, mime: "image/png" },
      ctx,
      { root, scan: async () => 0 },
    );
    await getDb().media.updateMany({
      where: { id: { in: [file.id, unused.id] } },
      data: { createdAt: new Date(Date.now() - 2 * 86400000) },
    });
    assert.equal(
      typeof m.cleanupEventUploads,
      "function",
      "Expired event upload cleanup exists",
    );
    assert.equal(await m.cleanupEventUploads(root), 1);
    assert.ok(await getDb().media.findUnique({ where: { id: file.id } }));
    assert.equal(
      await getDb().media.findUnique({ where: { id: unused.id } }),
      null,
    );
    await assert.rejects(
      submitEventRegistration(
        { ...input, idempotencyKey: randomUUID() },
        owner,
        ctx,
      ),
      { code: "INVALID_MEDIA" },
    );
    const { readMedia } = await import("../../../src/server/media/storage");
    await assert.rejects(readMedia(file.id, null, { root }), {
      code: "NOT_FOUND",
    });
    await getDb().user.update({
      where: { id: p.userId },
      data: { role: "POH" },
    });
    await assert.rejects(readMedia(file.id, { ...p, role: "POH" }, { root }), {
      code: "FORBIDDEN",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
