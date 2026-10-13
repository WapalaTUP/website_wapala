import test from "node:test";
import assert from "node:assert/strict";
test("book delivery rejects draft archived mismatched and oversized private media", async () => {
  const m = await import("../../src/server/domains/books").catch(() => null);
  assert.ok(m, "controlled book delivery implementation exists");
  const record = {
    published: true,
    archivedAt: null,
    fields: {
      judul: "Buku",
      file: "/api/media/12345678-1234-1234-1234-123456789abc",
      status: "Publik",
    },
  };
  const media = {
    id: "12345678-1234-1234-1234-123456789abc",
    purpose: "book",
    visibility: "private",
    scannedAt: new Date(),
    mime: "application/pdf",
    extension: "pdf",
    size: 100,
  };
  assert.equal(m.authorizePublishedBook(record, media).title, "Buku");
  for (const value of [
    { ...record, published: false },
    { ...record, archivedAt: new Date() },
  ])
    assert.throws(() => m.authorizePublishedBook(value, media), {
      code: "NOT_FOUND",
    });
  for (const value of [
    { ...media, purpose: "member-photo" },
    { ...media, id: "other" },
    { ...media, scannedAt: null },
  ])
    assert.throws(() => m.authorizePublishedBook(record, value), {
      code: "NOT_FOUND",
    });
  assert.throws(
    () =>
      m.authorizePublishedBook(record, { ...media, size: 51 * 1024 * 1024 }),
    { code: "MEDIA_TOO_LARGE" },
  );
});
