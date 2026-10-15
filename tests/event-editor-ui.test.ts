import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { randomUUID } from "node:crypto";
test("event text inputs have an accessible question name and editor mutations can be disabled", async () => {
  const { EventFormRenderer } =
    await import("../src/components/events/form-renderer");
  const q = {
    id: randomUUID(),
    kind: "shortText" as const,
    title: "Nama",
    help: "",
    required: false,
    options: [],
    gridRows: [],
    validation: {},
    other: false,
  };
  const html = renderToStaticMarkup(
    React.createElement(EventFormRenderer, {
      form: { title: "Uji", description: "", items: [q] },
      answers: {},
      onChange: () => {},
    }),
  );
  assert.match(html, /aria-label="Nama"/);
  const { QuestionEditor } =
    await import("../src/components/events/question-editor");
  const edit = renderToStaticMarkup(
    React.createElement(QuestionEditor, {
      q,
      prior: [],
      disabled: true,
      onChange: () => {},
      onMove: () => {},
      onRemove: () => {},
      onDuplicate: () => {},
    }),
  );
  assert.match(edit, /fieldset[^>]+disabled/);
});
test("event editor provides question response settings tabs and optional default fields", async () => {
  const m = await import("../src/components/events/event-editor").catch(
    () => null,
  );
  assert.ok(m, "Event editor exists");
  const html = renderToStaticMarkup(
    React.createElement(m.EventEditor, {
      initial: null,
      csrfToken: "test",
      onSaved: () => {},
      onClose: () => {},
    }),
  );
  assert.match(html, /Pertanyaan/);
  assert.match(html, /Respons/);
  assert.match(html, /Pengaturan/);
  assert.match(html, /Tambah pertanyaan/);
  assert.match(html, /Simpan draft/);
  assert.match(html, /Publikasikan/);
});
test("event public renderer respects conditional visibility and uses text identifiers", async () => {
  const m = await import("../src/components/events/form-renderer").catch(
    () => null,
  );
  assert.ok(m, "Event renderer exists");
  const q = {
    id: randomUUID(),
    kind: "shortText" as const,
    title: "NIM",
    required: false,
    help: "",
    options: [],
    gridRows: [],
    validation: {},
    other: false,
  };
  const html = renderToStaticMarkup(
    React.createElement(m.EventFormRenderer, {
      form: { title: "Camp Fire", description: "", items: [q] },
      answers: { [q.id]: "00123" },
      onChange: () => {},
    }),
  );
  assert.match(html, /type="text"/);
  assert.match(html, /00123/);
  assert.doesNotMatch(html, /required=""/);
});
test("paged renderer evaluates conditions from the whole form while rendering only current section", async () => {
  const m = await import("../src/components/events/form-renderer");
  const parent = {
    id: randomUUID(),
    kind: "radio" as const,
    title: "Status",
    required: false,
    help: "",
    options: [{ id: randomUUID(), label: "Mahasiswa" }],
    gridRows: [],
    validation: {},
    other: false,
  };
  const child = {
    ...parent,
    id: randomUUID(),
    kind: "shortText" as const,
    title: "NIM",
    options: [],
    showWhen: { questionId: parent.id, optionId: parent.options[0].id },
  };
  const html = renderToStaticMarkup(
    React.createElement(m.EventFormRenderer, {
      form: { title: "Uji", description: "", items: [parent, child] },
      answers: { [parent.id]: parent.options[0].id },
      itemIds: [child.id],
      onChange: () => {},
    }),
  );
  assert.match(html, /NIM/);
  assert.doesNotMatch(html, />Status</);
});
