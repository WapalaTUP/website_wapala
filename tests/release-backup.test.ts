import assert from "node:assert/strict";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
test("restore targets are distinct local staging databases, not production aliases", async () => {
  const { stagingDatabase } = await import(pathToFileURL(join(process.cwd(), "scripts/release-backup.mjs")).href);
  const production = "postgresql://app:secret@127.0.0.1:5432/wapala";
  assert.equal(stagingDatabase("postgresql://stage:secret@127.0.0.1:5432/wapala_restore_test", production).PGDATABASE, "wapala_restore_test");
  for (const value of [production, "postgresql://stage:secret@localhost:5432/wapala", "postgresql://stage:secret@localhost:5432/wapala?schema=other", "postgresql://stage:secret@remote:5432/wapala_restore_test", "postgresql://stage:secret@127.0.0.1:5432/wapala_restore_test?options=-csearch_path%3Dpublic"]) assert.throws(() => stagingDatabase(value, production), /staging/i);
});
