import { test } from "node:test";
import assert from "node:assert/strict";
import { splitContentFields, mergedContentFields } from "../src/lib/content-compatibility";
test("new metadata never enters legacy JSON fields read by main", () => {
  const input = { judul: "Berita", isi: "Teks", tags: ["SAR"], bloki: "[]", sampul: "" };
  const split = splitContentFields(input);
  assert.equal("tags" in split.fields, false);
  assert.equal("bloki" in split.fields, false);
  assert.deepEqual(mergedContentFields(split.fields, split.contentMeta), input);
});
test("editing with legacy code invalidates stale rich body but preserves tags", () => {
  const split = splitContentFields({ isi: "Lama", bloki: '[{"text":"Lama"}]', tags: ["SAR"] });
  const merged = mergedContentFields(
    { ...split.fields, isi: "Diubah kode lama" },
    split.contentMeta,
  );
  assert.equal(merged.bloki, undefined);
  assert.deepEqual(merged.tags, ["SAR"]);
});
test("legacy text stays bounded while full new article remains available", () => {
  const input = { isi: "a".repeat(12000) };
  const split = splitContentFields(input);
  assert.equal(String(split.fields.isi).length, 10000);
  assert.deepEqual(mergedContentFields(split.fields, split.contentMeta), input);
});
test("album metadata projects photo order, cover and captions for old main", () => {
  const split = splitContentFields({
    media_items: JSON.stringify([
      { id: "a", type: "image", src: "/images/a.webp", caption: "Foto A" },
      { id: "v", type: "video", src: "/api/media/video" },
      { id: "b", type: "image", src: "/images/b.webp", caption: "Foto B" },
    ]),
    featured_media: "b",
    gambar: ["/images/removed.webp"],
    sampul: "/images/removed.webp",
  });
  assert.deepEqual(split.fields.gambar, ["/images/a.webp", "/images/b.webp"]);
  assert.deepEqual(split.fields.keterangan_foto, ["Foto A", "Foto B"]);
  assert.equal(split.fields.sampul, "/images/b.webp");
});
test("old main caption edits invalidate stale album metadata", () => {
  const split = splitContentFields({
    media_items: JSON.stringify([
      { id: "a", type: "image", src: "/images/a.webp", caption: "Lama" },
    ]),
  });
  const merged = mergedContentFields(
    { ...split.fields, keterangan_foto: ["Baru"] },
    split.contentMeta,
  );
  assert.equal(merged.media_items, undefined);
  assert.deepEqual(merged.keterangan_foto, ["Baru"]);
});
