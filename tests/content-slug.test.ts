import test from "node:test";
import assert from "node:assert/strict";
import { contentSlug } from "../src/lib/content-slug";
test("article titles and user-entered slugs produce URL-safe names", () => {
  assert.equal(
    contentSlug("  Berita Kegiatan WAPALA!  "),
    "berita-kegiatan-wapala",
  );
  assert.equal(
    contentSlug("Announcement / Camp Fire 2026"),
    "announcement-camp-fire-2026",
  );
  assert.equal(
    contentSlug("berita-yang-sudah-valid"),
    "berita-yang-sudah-valid",
  );
  assert.ok(contentSlug("A".repeat(200)).length <= 160);
});
