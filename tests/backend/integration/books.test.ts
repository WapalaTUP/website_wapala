import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../../../src/server/db";
import { clean, ctx } from "./helpers";
import {
  createBootstrapToken,
  bootstrap,
} from "../../../src/server/auth/bootstrap";
import { login } from "../../../src/server/auth/login";
import { registerMedia, readMedia } from "../../../src/server/media/storage";
import { saveContent } from "../../../src/server/domains/records";
import { publishedBook } from "../../../src/server/domains/books";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
beforeEach(clean);
after(() => getDb().$disconnect());
test("only a current published book reference grants public bytes while raw media remains private", async () => {
  const root = await mkdtemp(join(tmpdir(), "wapala-book-test-")),
    previous = process.env.MEDIA_ROOT;
  process.env.MEDIA_ROOT = root;
  try {
    const token = await createBootstrapToken(ctx);
    await bootstrap(
      { token: token.token, password: "books-test-passphrase" },
      ctx,
    );
    const { principal } = await login(
      { email: "superuser@wapala.org", password: "books-test-passphrase" },
      ctx,
    );
    const bytes = Buffer.from("%PDF-1.7\n%test book\n");
    const media = await registerMedia(
      principal,
      { bytes, mime: "application/pdf", purpose: "book" },
      ctx,
      { root, scan: async () => 0 },
    );
    await assert.rejects(readMedia(media.id, null, { root }));
    const draft = await saveContent(
      principal,
      "buku",
      { fields: { judul: "Buku uji", file: media.url, status: "Draft" } },
      ctx,
    );
    await assert.rejects(publishedBook(draft.id, true), { code: "NOT_FOUND" });
    const live = await saveContent(
      principal,
      "buku",
      {
        id: draft.id,
        version: draft.version,
        fields: { judul: "Buku uji", file: media.url, status: "Publik" },
      },
      ctx,
    );
    assert.deepEqual((await publishedBook(live.id, true)).bytes, bytes);
    assert.equal(
      (await publishedBook(live.id)).url,
      "/api/books/" + live.id + "/file",
    );
    await saveContent(
      principal,
      "buku",
      {
        id: live.id,
        version: live.version,
        archived: true,
        fields: { judul: "Buku uji", file: media.url, status: "Publik" },
      },
      ctx,
    );
    await assert.rejects(publishedBook(live.id, true), { code: "NOT_FOUND" });
  } finally {
    if (previous === undefined) delete process.env.MEDIA_ROOT;
    else process.env.MEDIA_ROOT = previous;
    await rm(root, { recursive: true, force: true });
  }
});
