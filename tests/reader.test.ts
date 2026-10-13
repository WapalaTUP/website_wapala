import { test } from "node:test";
import assert from "node:assert/strict";
import { visibleBookPages, nextBookPage } from "../src/lib/reader-pages";
test("desktop spreads show two pages while mobile shows a single selected page", () => {
  assert.deepEqual(visibleBookPages(1, 90, true), [1, 2]);
  assert.deepEqual(visibleBookPages(11, 90, true), [11, 12]);
  assert.deepEqual(visibleBookPages(11, 90, false), [11]);
  assert.equal(nextBookPage(11, 90, true, 1), 13);
  assert.equal(nextBookPage(11, 90, false, 1), 12);
});
test("final odd pages and direct jumps cannot run past the end of the book", () => {
  assert.deepEqual(visibleBookPages(90, 90, true), [89, 90]);
  assert.deepEqual(visibleBookPages(91, 91, true), [91]);
  assert.deepEqual(visibleBookPages(1, 0, true), []);
  assert.equal(nextBookPage(90, 90, true, 1), 89);
  assert.equal(nextBookPage(1, 90, true, -1), 1);
});
