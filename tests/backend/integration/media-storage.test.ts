import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb } from "../../../src/server/db";
import { clean, ctx } from "./helpers";
import {
  createBootstrapToken,
  bootstrap,
} from "../../../src/server/auth/bootstrap";
import { login } from "../../../src/server/auth/login";
import type { Principal } from "../../../src/server/auth/policy";
let su: Principal, root: string;
const service = () =>
  import("../../../src/server/media/storage").catch(() => null);
beforeEach(async () => {
  await clean();
  root = await mkdtemp(join(tmpdir(), "wapala-media-test-"));
  const t = await createBootstrapToken(ctx);
  await bootstrap({ token: t.token, password: "media-test-passphrase" }, ctx);
  su = (
    await login(
      { email: "superuser@wapala.org", password: "media-test-passphrase" },
      ctx,
    )
  ).principal;
});
after(async () => {
  await getDb().$disconnect();
});
test("registered public photos are sanitized and private proof needs an authorized session", async () => {
  const m = await service();
  assert.ok(m);
  try {
    const bytes = await sharp({
      create: { width: 20, height: 40, channels: 3, background: "green" },
    })
      .png()
      .toBuffer();
    const image = await m.registerMedia(
      su,
      { bytes, mime: "image/png", purpose: "campaign" },
      ctx,
      { root, scan: async () => 0 },
    );
    assert.match(image.url, /^\/api\/media\/[-a-f0-9]{36}$/);
    const publicFile = await m.readMedia(image.id, null, { root });
    assert.equal(publicFile.mime, "image/webp");
    const { updateSettings } = await import("../../../src/server/settings");
    await assert.rejects(updateSettings(su, { logoUrl: image.url }, ctx), {
      code: "INVALID_MEDIA",
    });
    const branding = await m.registerMedia(
      su,
      { bytes, mime: "image/png", purpose: "branding" },
      ctx,
      { root, scan: async () => 0 },
    );
    const branded = await updateSettings(
      su,
      { logoUrl: branding.url, telULogoUrl: "" },
      ctx,
    );
    assert.equal((branded.config as { logoUrl: string }).logoUrl, branding.url);
    assert.equal((await sharp(publicFile.bytes).metadata()).height, 40);
    const proof = await m.registerMedia(
      su,
      { bytes, mime: "image/png", purpose: "donation-proof" },
      ctx,
      { root, scan: async () => 0 },
    );
    await assert.rejects(m.readMedia(proof.id, null, { root }));
    assert.equal(
      (await m.readMedia(proof.id, su, { root })).mime,
      "image/webp",
    );
    await assert.rejects(
      m.readMedia(proof.id, { ...su, role: "POH" }, { root }),
    );
    const { saveCampaign } =
      await import("../../../src/server/domains/campaigns");
    await assert.rejects(
      saveCampaign(
        su,
        {
          title: "Publik",
          description: "Tujuan",
          target: 1000,
          collaborator: "Uji",
          start: "",
          end: "",
          status: "draft",
          cover: "",
          poster: proof.url,
          qrisImage: "",
          bankAccounts: [],
        },
        ctx,
      ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("failed scanner never registers a usable media record", async () => {
  const m = await service();
  assert.ok(m);
  try {
    const bytes = await sharp({
      create: { width: 20, height: 40, channels: 3, background: "green" },
    })
      .png()
      .toBuffer();
    await assert.rejects(
      m.registerMedia(
        su,
        { bytes, mime: "image/png", purpose: "campaign" },
        ctx,
        { root, scan: async () => 1 },
      ),
    );
    assert.equal(await getDb().media.count(), 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
