import assert from "node:assert/strict";
import test from "node:test";
import {
  parseArticleBlocks,
  safeArticleLink,
  safeArticleMediaSource,
  articleVideoEmbed,
  articleBlocksSchema,
} from "./article-content";

test("legacy article paragraphs survive missing or invalid block JSON", () => {
  assert.deepEqual(
    parseArticleBlocks({ isi: "First\n\nSecond", bloki: "broken" }).map((b) => b.text),
    ["First", "Second"],
  );
});
test("server block schema rejects unsafe media, unknown fields, and duplicate identities", () => {
  assert.equal(
    articleBlocksSchema.safeParse([{ id: "x", type: "image", src: "https://evil.example/a.jpg" }])
      .success,
    false,
  );
  assert.equal(
    articleBlocksSchema.safeParse([{ id: "x", type: "paragraph", text: "hello", html: "<script>" }])
      .success,
    false,
  );
  assert.equal(
    articleBlocksSchema.safeParse([
      { id: "x", type: "paragraph", text: "one" },
      { id: "x", type: "paragraph", text: "two" },
    ]).success,
    false,
  );
});
test("article blocks reject executable and remote media sources", () => {
  const blocks = parseArticleBlocks({
    bloki: JSON.stringify([
      { id: "a", type: "image", src: "javascript:alert(1)" },
      { id: "b", type: "paragraph", text: "Safe" },
      { id: "c", type: "image", src: "/api/media/12345678-1234-4234-8234-123456789abc" },
    ]),
  });
  assert.deepEqual(
    blocks.map((b) => b.id),
    ["b", "c"],
  );
  assert.equal(safeArticleMediaSource("//evil.example/photo.jpg"), null);
  assert.equal(safeArticleMediaSource("/api/media/../secret"), null);
  assert.equal(safeArticleLink("javascript:alert(1)"), null);
  assert.equal(safeArticleLink("https://example.com/page"), "https://example.com/page");
});
test("video embeds use a fixed provider allowlist", () => {
  assert.equal(
    articleVideoEmbed("https://youtu.be/abcdefghijk"),
    "https://www.youtube-nocookie.com/embed/abcdefghijk",
  );
  assert.equal(articleVideoEmbed("https://youtube.com.evil.example/watch?v=abcdefghijk"), null);
  assert.equal(
    articleVideoEmbed("https://vimeo.com/12345678"),
    "https://player.vimeo.com/video/12345678",
  );
  assert.equal(
    articleVideoEmbed("https://www.instagram.com/reel/Abc_12/"),
    "https://www.instagram.com/reel/Abc_12/embed/",
  );
  assert.equal(
    articleVideoEmbed("https://www.tiktok.com/@wapala/video/1234567890"),
    "https://www.tiktok.com/player/v1/1234567890",
  );
  assert.equal(articleVideoEmbed("https://www.instagram.com.evil.example/reel/Abc_12/"), null);
});
