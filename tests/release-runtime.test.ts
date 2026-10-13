import assert from "node:assert/strict";
import { test } from "node:test";
import { bootStore, getDemo, resetStore, updateStore } from "../src/lib/store";
import { albums, books, generations, photos } from "../src/lib/content";
test("default client data has no fabricated records before or after legacy preview boot", () => {
  const original = getDemo();
  assert.equal(original.backend, true);
  for (const key of [
    "campaigns",
    "equipment",
    "loans",
    "applicants",
    "donations",
    "audit",
  ] as const)
    assert.deepEqual(original[key], []);
  assert.ok(Object.values(original.records).every((rows) => rows.length === 0));
  bootStore(true);
  assert.equal(getDemo(), original);
});
test("legacy client mutation paths cannot persist server authority", () => {
  let called = false;
  assert.throws(
    () =>
      updateStore(() => {
        called = true;
      }),
    /server/i,
  );
  assert.equal(called, false);
  assert.throws(() => resetStore(), /server/i);
});
test("runtime static catalog is empty and image fallbacks are neutral assets", () => {
  assert.deepEqual(albums, []);
  assert.deepEqual(books, []);
  assert.deepEqual(generations, []);
  assert.ok(
    Object.values(photos).every((path) => path === "/assets/placeholder.svg"),
  );
});
