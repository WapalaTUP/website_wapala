import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { EventQuestion } from "../src/lib/event-form";
const service = () => import("../src/lib/event-form").catch(() => null);
test("scale defaults cannot create an impossible range", async () => {
  const m = await service();
  assert.ok(m);
  for (const validation of [{ min: 10 }, { max: 0 }, { min: 10, max: 1 }])
    assert.equal(
      m.eventFormSchema.safeParse({
        title: "Uji",
        description: "",
        items: [question("scale", { required: true, validation })],
      }).success,
      false,
    );
});
test("required text rejects whitespace while optional whitespace stays unavailable", async () => {
  const m = await service();
  assert.ok(m);
  const q = question("shortText", { required: true });
  const form = m.eventFormSchema.parse({
    title: "Uji",
    description: "",
    items: [q],
  });
  assert.equal(
    m.validateEventAnswers(form, { [q.id]: "   " }).issues.length,
    1,
  );
  assert.deepEqual(
    m.validateEventAnswers(
      { ...form, items: [{ ...q, required: false }] },
      { [q.id]: "   " },
    ).answers,
    {},
  );
});
const question = (
  kind: EventQuestion["kind"] = "shortText",
  more: Partial<EventQuestion> = {},
): EventQuestion => ({
  id: randomUUID(),
  kind,
  title: "Nama",
  help: "",
  required: false,
  options: [],
  gridRows: [],
  validation: {},
  other: false,
  ...more,
});
test("event forms allow empty optional answers and enforce only visible required fields", async () => {
  const m = await service();
  assert.ok(m, "Shared event validator exists");
  const a = question("radio", {
    options: [{ id: randomUUID(), label: "Mahasiswa" }],
  });
  const b = question("shortText", {
    required: true,
    showWhen: { questionId: a.id, optionId: a.options[0].id },
  });
  const form = m.eventFormSchema.parse({
    title: "Camp Fire",
    description: "",
    items: [a, b],
  });
  assert.deepEqual(m.validateEventAnswers(form, {}).issues, []);
  assert.equal(
    m.validateEventAnswers(form, { [a.id]: a.options[0].id }).issues.length,
    1,
  );
  assert.deepEqual(
    m.validateEventAnswers(form, { [b.id]: "hidden" }).answers,
    {},
  );
});
test("event definitions reject duplicate IDs forward conditions excessive items and invalid ranges", async () => {
  const m = await service();
  assert.ok(m);
  const a = question(),
    base = { title: "Uji", description: "" };
  for (const items of [
    [a, a],
    Array(201).fill(a),
    [question("number", { validation: { min: 10, max: 1 } })],
    [
      question("shortText", {
        showWhen: { questionId: randomUUID(), optionId: randomUUID() },
      }),
    ],
  ])
    assert.equal(
      m.eventFormSchema.safeParse({ ...base, items }).success,
      false,
    );
});
test("event answer types choices grids dates and numeric limits validate without coercing identifiers", async () => {
  const m = await service();
  assert.ok(m);
  const text = question(),
    number = question("number", { validation: { min: 1, max: 3 } }),
    email = question("email"),
    date = question("date"),
    time = question("time"),
    file = question("upload"),
    scale = question("scale", { validation: { min: 1, max: 5 } });
  const radio = question("radio", {
      options: [{ id: randomUUID(), label: "A" }],
    }),
    checks = question("checkbox", {
      options: [{ id: randomUUID(), label: "B" }],
    }),
    grid = question("radioGrid", {
      options: [{ id: randomUUID(), label: "A" }],
      gridRows: [{ id: randomUUID(), label: "Baris" }],
    });
  const form = m.eventFormSchema.parse({
    title: "Types",
    description: "",
    items: [text, number, email, date, time, file, scale, radio, checks, grid],
  });
  const values = {
    [text.id]: "00123",
    [number.id]: 2,
    [email.id]: "a@example.org",
    [date.id]: "2026-10-13",
    [time.id]: "12:30",
    [file.id]: randomUUID(),
    [scale.id]: 3,
    [radio.id]: radio.options[0].id,
    [checks.id]: [checks.options[0].id],
    [grid.id]: { [grid.gridRows[0].id]: grid.options[0].id },
  };
  assert.deepEqual(m.validateEventAnswers(form, values).issues, []);
  assert.equal(m.validateEventAnswers(form, values).answers[text.id], "00123");
  const invalid: Array<[string, unknown]> = [
    [number.id, 9],
    [email.id, "bad"],
    [date.id, "2026-02-30"],
    [time.id, "29:99"],
    [file.id, "https://evil.test/file"],
    [radio.id, randomUUID()],
    [checks.id, [checks.options[0].id, checks.options[0].id]],
  ];
  for (const [id, value] of invalid)
    assert.ok(
      m.validateEventAnswers(form, { ...values, [id]: value }).issues.length,
    );
  assert.ok(
    m.validateEventAnswers(form, { [randomUUID()]: "unknown" }).issues.length,
  );
});
test("duplicate and meaning changes allocate fresh question option IDs", async () => {
  const m = await service();
  assert.ok(m);
  const a = question("radio", { options: [{ id: randomUUID(), label: "A" }] });
  const form = m.eventFormSchema.parse({
    title: "Uji",
    description: "",
    items: [a],
  });
  const copied = m.duplicateQuestion(form, a.id);
  assert.notEqual(copied.items[1].id, a.id);
  assert.notEqual(copied.items[1].options[0].id, a.options[0].id);
  assert.equal(copied.items[1].options[0].label, "A");
});
