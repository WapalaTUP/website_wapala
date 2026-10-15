import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { newEventQuestion, type EventForm } from "../src/lib/event-form";
test("saving meaning changes renews IDs and remaps dependent conditions", async () => {
  const m = await import("../src/lib/event-form");
  assert.equal(
    typeof m.rekeyChangedQuestions,
    "function",
    "Meaning-safe save helper exists",
  );
  const a = newEventQuestion("radio"),
    b = {
      ...newEventQuestion(),
      showWhen: { questionId: a.id, optionId: a.options[0].id },
    };
  const original: EventForm = { title: "Uji", description: "", items: [a, b] };
  const edited = structuredClone(original);
  edited.items[0].options[0].label = "Berubah";
  const fresh = m.rekeyChangedQuestions(edited, [original]);
  assert.notEqual(fresh.items[0].id, a.id);
  assert.notEqual(fresh.items[0].options[0].id, a.options[0].id);
  assert.equal(fresh.items[1].showWhen?.questionId, fresh.items[0].id);
  assert.equal(fresh.items[1].showWhen?.optionId, fresh.items[0].options[0].id);
  assert.equal(m.rekeyChangedQuestions(original, [original]).items[0].id, a.id);
  assert.ok(randomUUID());
});
