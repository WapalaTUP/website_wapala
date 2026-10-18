import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

const database = process.env.MEDIA_TEST_DATABASE_URL;
test(
  "media migrations accept album MP4 while retaining existing media and public-file restrictions",
  { skip: !database },
  async () => {
    // Explicit test database only. All DDL and rows also remain in a temporary table.
    if (!new URL(database!).pathname.endsWith("_test"))
      throw new Error("MEDIA_TEST_DATABASE_URL must name a database ending in _test.");
    const client = new Client({ connectionString: database });
    await client.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL search_path = pg_temp");
      const migration = (name: string) =>
        readFile(`prisma/migrations/${name}/migration.sql`, "utf8");
      await client.query(
        (await migration("202610130005_media")).replace(
          'CREATE TABLE "Media"',
          'CREATE TEMP TABLE "Media"',
        ),
      );
      await client.query(await migration("202610130006_epub_media"));
      const insert = (purpose: string, visibility: string, mime: string, extension: string) =>
        client.query(
          `INSERT INTO "Media" (id,purpose,visibility,mime,extension,checksum,"originalHash",size,"scannedAt") VALUES ($1,$2,$3,$4,$5,'test','test',1,CURRENT_TIMESTAMP)`,
          [randomUUID(), purpose, visibility, mime, extension],
        );
      async function rejected(
        purpose: string,
        visibility: string,
        mime: string,
        extension: string,
      ) {
        await client.query("SAVEPOINT rejected_media");
        try {
          await assert.rejects(
            () => insert(purpose, visibility, mime, extension),
            (error: unknown) =>
              !!error && typeof error === "object" && "code" in error && error.code === "23514",
          );
        } finally {
          await client.query("ROLLBACK TO SAVEPOINT rejected_media");
          await client.query("RELEASE SAVEPOINT rejected_media");
        }
      }
      await insert("content", "public", "image/webp", "webp");
      await insert("book", "private", "application/pdf", "pdf");
      await insert("book", "private", "application/epub+zip", "epub");
      await rejected("content-video", "public", "video/mp4", "mp4");
      await client.query(await migration("202610180003_album_video_media"));
      assert.equal(Number((await client.query('SELECT count(*) FROM "Media"')).rows[0].count), 3);
      await insert("content-video", "public", "video/mp4", "mp4");
      await insert("content", "public", "image/webp", "webp");
      await insert("book", "private", "application/pdf", "pdf");
      await insert("book", "private", "application/epub+zip", "epub");
      await rejected("book", "public", "application/pdf", "pdf");
      await rejected("content-video", "public", "video/mp4", "webp");
      await rejected("branding", "public", "video/mp4", "mp4");
      await rejected("content", "public", "image/gif", "gif");
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      await client.end();
    }
  },
);
