import { test } from "node:test";
import assert from "node:assert/strict";
import { momentPanelCount } from "../src/lib/featured-moments";
test("landscape video occupies the entire featured media area", () => {
  assert.equal(momentPanelCount({ type: "video", orientation: "landscape" }), 1);
  assert.equal(momentPanelCount({ type: "instagram", orientation: "landscape" }), 1);
});
test("portrait video and photos leave room for the next album", () => {
  assert.equal(momentPanelCount({ type: "video", orientation: "portrait" }), 2);
  assert.equal(momentPanelCount({ type: "image", orientation: "landscape" }), 2);
});
