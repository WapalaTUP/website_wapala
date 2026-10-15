import assert from "node:assert/strict";
import { test } from "node:test";
import { previewMode } from "../../src/server/auth/preview-mode";
test("preview environment cannot expose legacy local authority in any deployment mode", () => {
  const env = process.env as Record<string, string | undefined>;
  const oldNode = env.NODE_ENV,
    oldMode = env.WAPALA_MODE;
  try {
    env.WAPALA_MODE = "preview";
    for (const mode of ["production", "development", "test"]) {
      env.NODE_ENV = mode;
      assert.equal(previewMode(), false);
    }
  } finally {
    if (oldNode === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = oldNode;
    if (oldMode === undefined) delete env.WAPALA_MODE;
    else env.WAPALA_MODE = oldMode;
  }
});
