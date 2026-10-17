import assert from "node:assert/strict";
import test from "node:test";
import { nextBookPage, visibleBookPages } from "./reader-pages";

test("desktop keeps the cover alone and subsequent pages in book spreads", () => {
  assert.deepEqual(visibleBookPages(1, 6, true), [1]);
  assert.deepEqual(visibleBookPages(3, 6, true), [2, 3]);
  assert.deepEqual(visibleBookPages(6, 6, true), [6]);
});
test("navigation reaches every spread without skipping the cover or last page", () => {
  assert.equal(nextBookPage(1, 6, true, 1), 2);
  assert.equal(nextBookPage(2, 6, true, 1), 4);
  assert.equal(nextBookPage(6, 6, true, -1), 4);
  assert.equal(nextBookPage(2, 6, true, -1), 1);
  assert.equal(nextBookPage(6, 6, true, 1), 6);
});
test("mobile and boundary inputs select a single valid page", () => {
  assert.deepEqual(visibleBookPages(3, 6, false), [3]);
  assert.deepEqual(visibleBookPages(99, 6, false), [6]);
  assert.deepEqual(visibleBookPages(-5, 6, true), [1]);
  assert.deepEqual(visibleBookPages(1, 0, true), []);
  assert.equal(nextBookPage(3, 6, false, -1), 2);
});
