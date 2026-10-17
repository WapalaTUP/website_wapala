import { test } from "node:test";
import assert from "node:assert/strict";
import { dataResetSnapshot } from "../src/server/domains/reset-snapshot";

const id = "550e8400-e29b-41d4-a716-446655440000";
const rows = [{ id, version: 1 }];
const dependencies = { users: [{ id: "linked-user", credentialVersion: 0 }], corrections: [] };
test("preview and confirmation accept identical selections with different property order", () => {
  const preview = { target: "members", id, mode: "delete" };
  const confirmation = { target: "members", mode: "delete", id };
  assert.equal(
    dataResetSnapshot(preview, rows, 0, dependencies),
    dataResetSnapshot(confirmation, rows, 0, dependencies),
  );
});
test("omitted and undefined selection IDs match for bulk reset", () => {
  assert.equal(
    dataResetSnapshot({ target: "members", mode: "delete" }, rows, 0, null),
    dataResetSnapshot({ target: "members", mode: "delete", id: undefined }, rows, 0, null),
  );
});
test("changed target record or dependent account still invalidates a deletion preview", () => {
  const selection = { target: "members", id, mode: "delete" };
  const hash = dataResetSnapshot(selection, rows, 0, dependencies);
  assert.notEqual(
    hash,
    dataResetSnapshot(
      { ...selection, id: "550e8400-e29b-41d4-a716-446655440001" },
      rows,
      0,
      dependencies,
    ),
  );
  assert.notEqual(hash, dataResetSnapshot(selection, [{ id, version: 2 }], 0, dependencies));
  assert.notEqual(hash, dataResetSnapshot(selection, rows, 0, { users: [], corrections: [] }));
  assert.notEqual(hash, dataResetSnapshot(selection, rows, 1, dependencies));
});
