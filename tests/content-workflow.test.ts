import { test } from "node:test";
import assert from "node:assert/strict";
import { editorialTransition } from "../src/lib/editorial-workflow";
import { parseContentTags, hasContentTag } from "../src/lib/content-tags";

test("members cannot publish or return articles", () => {
  assert.throws(() => editorialTransition("ANGGOTA", "draft", "publish"));
  assert.throws(() => editorialTransition("ANGGOTA", "submitted", "return"));
});
test("submission, return and publication require explicit review actions", () => {
  assert.equal(editorialTransition("ANGGOTA", "returned", "submit"), "submitted");
  assert.equal(editorialTransition("MULTIMEDIA", "submitted", "return"), "returned");
  assert.equal(editorialTransition("MULTIMEDIA", "submitted", "publish"), "published");
  assert.equal(editorialTransition("MULTIMEDIA", "submitted", "save"), "submitted");
  assert.equal(editorialTransition("ANGGOTA", "published", "save"), "draft");
});
test("members cannot overwrite an article during review", () => {
  assert.throws(() => editorialTransition("ANGGOTA", "submitted", "save"));
});
test("shared tags handle serialized public fields, deduplicate and do not match substrings", () => {
  assert.deepEqual(parseContentTags('["Gunung Hutan","SAR","SAR"]'), ["Gunung Hutan", "SAR"]);
  assert.deepEqual(parseContentTags(["arbitrary"]), []);
  assert.equal(hasContentTag({ tags: '["SAR"]' }, "SAR"), true);
  assert.equal(hasContentTag({ tags: '["SAR"]' }, "Rafting"), false);
});
