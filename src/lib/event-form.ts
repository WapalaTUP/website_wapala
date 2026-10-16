import { z } from "zod";
export const eventKinds = [
  "shortText",
  "paragraph",
  "number",
  "email",
  "date",
  "time",
  "radio",
  "checkbox",
  "select",
  "upload",
  "scale",
  "radioGrid",
  "checkboxGrid",
  "section",
] as const;
export const eventKindLabels: Record<(typeof eventKinds)[number], string> = {
  shortText: "Jawaban singkat",
  paragraph: "Paragraf",
  number: "Angka",
  email: "Email",
  date: "Tanggal",
  time: "Waktu",
  radio: "Pilihan ganda",
  checkbox: "Kotak centang",
  select: "Dropdown",
  upload: "Upload berkas",
  scale: "Skala linear",
  radioGrid: "Kisi pilihan ganda",
  checkboxGrid: "Kisi kotak centang",
  section: "Bagian",
};
const option = z.object({ id: z.uuid(), label: z.string().trim().min(1).max(300) }).strict();
const limits = z
  .object({
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    minLength: z.number().int().min(0).max(10000).optional(),
    maxLength: z.number().int().min(1).max(10000).optional(),
    minChoices: z.number().int().min(0).max(200).optional(),
    maxChoices: z.number().int().min(1).max(200).optional(),
    minDate: z.union([z.literal(""), z.iso.date()]).optional(),
    maxDate: z.union([z.literal(""), z.iso.date()]).optional(),
  })
  .strict();
export const eventQuestionSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(eventKinds),
    title: z.string().trim().min(1).max(300),
    help: z.string().max(2000).default(""),
    required: z.boolean().default(false),
    options: z.array(option).max(200).default([]),
    gridRows: z.array(option).max(200).default([]),
    other: z.boolean().default(false),
    validation: limits.default({}),
    showWhen: z.object({ questionId: z.uuid(), optionId: z.uuid() }).strict().optional(),
  })
  .strict();
export const eventFormSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(10000),
    items: z.array(eventQuestionSchema).max(200),
  })
  .strict()
  .superRefine((f, c) => {
    const ids = new Set<string>();
    const prior = new Map<string, z.infer<typeof eventQuestionSchema>>();
    f.items.forEach((q, i) => {
      const fail = (message: string) => c.addIssue({ code: "custom", path: ["items", i], message });
      for (const id of [q.id, ...q.options.map((x) => x.id), ...q.gridRows.map((x) => x.id)]) {
        if (ids.has(id)) fail("ID pertanyaan/pilihan harus unik.");
        ids.add(id);
      }
      if (
        ["radio", "checkbox", "select", "radioGrid", "checkboxGrid"].includes(q.kind) &&
        !q.options.length
      )
        fail("Tambahkan minimal satu pilihan.");
      if (q.kind.endsWith("Grid") && !q.gridRows.length) fail("Tambahkan baris kisi.");
      if (q.kind === "section" && q.required) fail("Bagian bukan pertanyaan wajib.");
      for (const [lo, hi] of [
        [q.validation.min, q.validation.max],
        [q.validation.minLength, q.validation.maxLength],
        [q.validation.minChoices, q.validation.maxChoices],
      ])
        if (lo !== undefined && hi !== undefined && lo > hi)
          fail("Batas minimum melebihi maksimum.");
      if (
        q.validation.minDate &&
        q.validation.maxDate &&
        q.validation.minDate > q.validation.maxDate
      )
        fail("Rentang tanggal tidak valid.");
      if (
        q.kind === "scale" &&
        (!Number.isInteger(q.validation.min ?? 1) ||
          !Number.isInteger(q.validation.max ?? 5) ||
          (q.validation.min ?? 1) > (q.validation.max ?? 5) ||
          (q.validation.max ?? 5) - (q.validation.min ?? 1) > 20)
      )
        fail("Skala maksimal 21 nilai bilangan bulat.");
      if (q.showWhen) {
        const p = prior.get(q.showWhen.questionId);
        if (
          !p ||
          !["radio", "select", "checkbox"].includes(p.kind) ||
          !p.options.some((o) => o.id === q.showWhen!.optionId)
        )
          fail("Kondisi harus mengacu pilihan pada pertanyaan sebelumnya.");
      }
      prior.set(q.id, q);
    });
  });
export type EventForm = z.infer<typeof eventFormSchema>;
export type EventQuestion = EventForm["items"][number];
export type EventAnswer = string | number | string[] | Record<string, string | string[]>;
export type EventAnswers = Record<string, EventAnswer>;
export type EventIssue = { questionId: string; message: string };
export function visibleEventItems(form: EventForm, answers: EventAnswers) {
  const visible = new Set<string>();
  let sectionVisible = true;
  return form.items.filter((q) => {
    const rule = q.showWhen,
      source = rule ? answers[rule.questionId] : undefined;
    const shown =
      !rule ||
      (visible.has(rule.questionId) &&
        (source === rule.optionId || (Array.isArray(source) && source.includes(rule.optionId))));
    if (q.kind === "section") sectionVisible = shown;
    const result = sectionVisible && shown;
    if (result) visible.add(q.id);
    return result;
  });
}
export function validateEventAnswers(
  form: EventForm,
  input: unknown,
): { answers: EventAnswers; issues: EventIssue[] } {
  const answers: EventAnswers = {},
    issues: EventIssue[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input))
    return {
      answers,
      issues: [{ questionId: "", message: "Jawaban tidak valid." }],
    };
  const raw = input as Record<string, unknown>,
    known = new Set(form.items.filter((q) => q.kind !== "section").map((q) => q.id));
  for (const id of Object.keys(raw))
    if (!known.has(id)) issues.push({ questionId: id, message: "Pertanyaan tidak dikenal." });
  const visible = visibleEventItems(form, raw as EventAnswers);
  for (const q of visible) {
    if (q.kind === "section") continue;
    const v = raw[q.id],
      l = q.validation;
    const empty =
      v === undefined ||
      v === null ||
      v === "" ||
      (typeof v === "string" && !v.trim()) ||
      (Array.isArray(v) && !v.length) ||
      (typeof v === "object" && v !== null && !Object.keys(v).length);
    if (empty) {
      if (q.required)
        issues.push({
          questionId: q.id,
          message: "Pertanyaan ini wajib diisi.",
        });
      continue;
    }
    let valid = true;
    const choice = (x: unknown) =>
      typeof x === "string" &&
      (q.options.some((o) => o.id === x) ||
        (q.other &&
          ["radio", "checkbox"].includes(q.kind) &&
          x.startsWith("other:") &&
          x.slice(6).trim().length > 0 &&
          x.length <= 306));
    const choices = (x: unknown) =>
      Array.isArray(x) &&
      x.length <= 200 &&
      new Set(x).size === x.length &&
      x.every(choice) &&
      x.length >= (l.minChoices ?? 0) &&
      x.length <= (l.maxChoices ?? 200);
    switch (q.kind) {
      case "number":
      case "scale":
        valid =
          typeof v === "number" &&
          Number.isFinite(v) &&
          v >= (l.min ?? (q.kind === "scale" ? 1 : -Infinity)) &&
          v <= (l.max ?? (q.kind === "scale" ? 5 : Infinity)) &&
          (q.kind !== "scale" || Number.isInteger(v));
        break;
      case "radio":
      case "select":
        valid = choice(v);
        break;
      case "checkbox":
        valid = choices(v);
        break;
      case "radioGrid":
      case "checkboxGrid": {
        valid = typeof v === "object" && v !== null && !Array.isArray(v);
        if (valid) {
          const grid = v as Record<string, unknown>;
          valid =
            Object.keys(grid).every((id) => q.gridRows.some((r) => r.id === id)) &&
            Object.values(grid).every((x) => (q.kind === "radioGrid" ? choice(x) : choices(x))) &&
            (!q.required ||
              q.gridRows.every(
                (r) =>
                  grid[r.id] !== undefined &&
                  (q.kind === "radioGrid"
                    ? choice(grid[r.id])
                    : choices(grid[r.id]) && (grid[r.id] as string[]).length > 0),
              ));
        }
        break;
      }
      default:
        valid =
          typeof v === "string" &&
          v.length <= 10000 &&
          v.length >= (l.minLength ?? 0) &&
          v.length <= (l.maxLength ?? 10000);
        if (valid && q.kind === "email") valid = z.email().safeParse(v).success;
        if (valid && q.kind === "date")
          valid =
            z.iso.date().safeParse(v).success &&
            (!l.minDate || (v as string) >= l.minDate) &&
            (!l.maxDate || (v as string) <= l.maxDate);
        if (valid && q.kind === "time") valid = /^([01]\d|2[0-3]):[0-5]\d$/.test(v as string);
        if (valid && q.kind === "upload") valid = z.uuid().safeParse(v).success;
    }
    if (!valid)
      issues.push({
        questionId: q.id,
        message: "Jawaban belum sesuai tipe, pilihan, atau batas yang ditentukan.",
      });
    else answers[q.id] = v as EventAnswer;
  }
  return { answers, issues };
}
export function newEventQuestion(kind: EventQuestion["kind"] = "shortText"): EventQuestion {
  return {
    id: crypto.randomUUID(),
    kind,
    title: kind === "section" ? "Bagian baru" : "Pertanyaan tanpa judul",
    help: "",
    required: false,
    options: ["radio", "checkbox", "select", "radioGrid", "checkboxGrid"].includes(kind)
      ? [{ id: crypto.randomUUID(), label: "Pilihan 1" }]
      : [],
    gridRows: kind.endsWith("Grid") ? [{ id: crypto.randomUUID(), label: "Baris 1" }] : [],
    other: false,
    validation: kind === "scale" ? { min: 1, max: 5 } : {},
  };
}
export function duplicateQuestion(form: EventForm, id: string): EventForm {
  const i = form.items.findIndex((q) => q.id === id);
  if (i < 0) return form;
  const q = form.items[i],
    copy = {
      ...structuredClone(q),
      id: crypto.randomUUID(),
      options: q.options.map((o) => ({ ...o, id: crypto.randomUUID() })),
      gridRows: q.gridRows.map((o) => ({ ...o, id: crypto.randomUUID() })),
    };
  return {
    ...form,
    items: [...form.items.slice(0, i + 1), copy, ...form.items.slice(i + 1)],
  };
}
export function eventAnswerLabel(
  q: EventQuestion,
  value: EventAnswer | undefined,
): string | number {
  if (value === undefined) return "";
  if (typeof value === "number") return value;
  const label = (v: string) =>
    q.options.find((o) => o.id === v)?.label || (v.startsWith("other:") ? v.slice(6) : v);
  if (Array.isArray(value)) return value.map(label).join("; ");
  if (typeof value === "object")
    return q.gridRows
      .filter((r) => value[r.id] !== undefined)
      .map(
        (r) =>
          r.label +
          ": " +
          (Array.isArray(value[r.id])
            ? (value[r.id] as string[]).map(label).join(", ")
            : label(value[r.id] as string)),
      )
      .join("; ");
  return ["radio", "select"].includes(q.kind) ? label(value) : value;
}
export function rekeyChangedQuestions(form: EventForm, history: EventForm[]): EventForm {
  const result = structuredClone(form),
    questionIds = new Map<string, string>(),
    optionIds = new Map<string, string>();
  for (const q of result.items) {
    const previous = history.flatMap((f) => f.items).filter((x) => x.id === q.id);
    const changed = previous.some(
      (p) =>
        p.kind !== q.kind ||
        JSON.stringify(p.options) !== JSON.stringify(q.options) ||
        JSON.stringify(p.gridRows) !== JSON.stringify(q.gridRows),
    );
    if (!changed) continue;
    const id = crypto.randomUUID();
    questionIds.set(q.id, id);
    q.id = id;
    q.options = q.options.map((o) => {
      const id = crypto.randomUUID();
      optionIds.set(o.id, id);
      return { ...o, id };
    });
    q.gridRows = q.gridRows.map((o) => ({ ...o, id: crypto.randomUUID() }));
  }
  for (const q of result.items)
    if (q.showWhen)
      q.showWhen = {
        questionId: questionIds.get(q.showWhen.questionId) ?? q.showWhen.questionId,
        optionId: optionIds.get(q.showWhen.optionId) ?? q.showWhen.optionId,
      };
  return result;
}
