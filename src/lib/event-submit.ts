import type { EventAnswers } from "./event-form";
export function eventFailureAction(
  status: number,
  code: string,
): "reconcile" | "retry" | "refresh" | "correct" {
  if (code === "EVENT_TOKEN_EXPIRED") return "reconcile";
  if (status >= 500) return "retry";
  if (code === "FORM_CHANGED") return "refresh";
  return "correct";
}
export function retainedEventAnswers(
  form: { items: ReadonlyArray<{ id: string; kind: string }> },
  previous: EventAnswers,
) {
  const answers: EventAnswers = {};
  let clearedUploads = 0;
  for (const q of form.items) {
    if (previous[q.id] === undefined) continue;
    if (q.kind === "upload") {
      clearedUploads++;
      continue;
    }
    if (q.kind !== "section") answers[q.id] = previous[q.id];
  }
  return { answers, clearedUploads };
}
