import { test } from "node:test";
import assert from "node:assert/strict";
import { parseByteRange } from "./media-range";
test("single byte ranges support browser seeking and reject ambiguous ranges", () => {
  assert.deepEqual(parseByteRange("bytes=10-20", 100), { start: 10, end: 20 });
  assert.deepEqual(parseByteRange("bytes=90-", 100), { start: 90, end: 99 });
  assert.deepEqual(parseByteRange("bytes=-10", 100), { start: 90, end: 99 });
  assert.deepEqual(parseByteRange("bytes=90-900", 100), { start: 90, end: 99 });
  for (const range of [
    "bytes=100-",
    "bytes=-0",
    "bytes=30-20",
    "bytes=1-2,3-4",
    "bytes=-",
    "bytes=9007199254740992-",
  ])
    assert.equal(parseByteRange(range, 100), null);
});
