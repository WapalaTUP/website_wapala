import { test } from "node:test";
import assert from "node:assert/strict";
import {
  albumMediaItemsSchema,
  parseAlbumMedia,
  parseExternalAlbumUrl,
  mediaOrientation,
} from "./album-media";
test("orientation follows verified dimensions for photo and video uploads", () => {
  assert.equal(mediaOrientation(1080, 1920), "portrait");
  assert.equal(mediaOrientation(1920, 1080), "landscape");
  assert.equal(mediaOrientation(1080, 1080), "landscape");
  assert.equal(mediaOrientation(null, null), "landscape");
  assert.equal(mediaOrientation(-1, 1080), "landscape");
});
test("provider URLs are canonical and cannot escape the provider", () => {
  assert.equal(
    parseExternalAlbumUrl("https://www.instagram.com/reel/Ab_C-12/?utm_source=x")?.embed,
    "https://www.instagram.com/reel/Ab_C-12/embed/",
  );
  assert.equal(
    parseExternalAlbumUrl("https://www.tiktok.com/@wapala/video/123456789")?.embed,
    "https://www.tiktok.com/player/v1/123456789",
  );
  for (const url of [
    "javascript:alert(1)",
    "https://instagram.com.evil.test/p/foo",
    "https://instagram.com@evil.test/p/foo",
    "https://www.instagram.com:8443/p/foo",
    "https://www.tiktok.com/embed/123",
    "<iframe src=x>",
    "https://instagram.com/p/%22onload=alert(1)",
  ])
    assert.equal(parseExternalAlbumUrl(url), null);
});
test("media payload rejects external uploads, malformed JSON, duplicate IDs and oversized albums", () => {
  const item = {
    id: "one",
    type: "image",
    src: "/api/media/550e8400-e29b-41d4-a716-446655440000",
    caption: "",
    orientation: "landscape",
  };
  assert.equal(albumMediaItemsSchema.safeParse([item]).success, true);
  assert.equal(
    albumMediaItemsSchema.safeParse([{ ...item, src: "https://evil.test/tracker" }]).success,
    false,
  );
  assert.equal(albumMediaItemsSchema.safeParse([item, item]).success, false);
  assert.equal(
    albumMediaItemsSchema.safeParse(
      Array.from({ length: 501 }, (_, i) => ({ ...item, id: `${i}` })),
    ).success,
    false,
  );
  assert.deepEqual(parseAlbumMedia({ media_items: "{bad json" }), []);
  assert.equal(parseAlbumMedia({ gambar: "/images/legacy.webp" })[0]?.src, "/images/legacy.webp");
  assert.deepEqual(
    parseAlbumMedia({
      gambar: ["/images/a.webp", "/images/b.webp"],
      sampul: "/images/b.webp",
      keterangan_foto: '["Caption A","Caption B"]',
    }).map(({ src, caption }) => ({ src, caption })),
    [
      { src: "/images/b.webp", caption: "Caption B" },
      { src: "/images/a.webp", caption: "Caption A" },
    ],
  );
  assert.equal(parseAlbumMedia({ gambar: '["/images/a.webp","/images/b.webp"]' }).length, 2);
  assert.equal(
    parseAlbumMedia({ gambar: "", sampul: "/images/cover.webp" })[0]?.src,
    "/images/cover.webp",
  );
  assert.deepEqual(parseAlbumMedia({ gambar: "javascript:alert(1)" }), []);
});
