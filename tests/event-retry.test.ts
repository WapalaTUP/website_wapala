import test from "node:test";
import assert from "node:assert/strict";
test("expired capability preserves uncertain attempt for reconciliation and refreshed uploads are cleared explicitly", async () => {
  const m = await import("../src/lib/event-submit").catch(() => null);
  assert.ok(m, "Submission recovery policy exists");
  assert.equal(m.eventFailureAction(403, "EVENT_TOKEN_EXPIRED"), "reconcile");
  assert.equal(m.eventFailureAction(503, "INTERNAL"), "retry");
  const form = {
    title: "Uji",
    description: "",
    items: [
      { id: "text", kind: "shortText", title: "NIM" },
      { id: "file", kind: "upload", title: "Foto" },
    ],
  };
  const kept = m.retainedEventAnswers(form, {
    text: "00123",
    file: "old-upload",
  });
  assert.deepEqual(kept.answers, { text: "00123" });
  assert.equal(kept.clearedUploads, 1);
});
