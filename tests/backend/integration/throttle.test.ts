import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../../../src/server/db";
import { clean } from "./helpers";
beforeEach(clean);
after(() => getDb().$disconnect());
test("persistent throttle permits only its configured number under concurrency", async () => {
  const m = await import("../../../src/server/security/throttle").catch(
    () => null,
  );
  assert.ok(m);
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () => m.takeThrottle("test-key", 3, 60000)),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 3);
});
