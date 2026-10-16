"use client";
import { useId, useState } from "react";
import {
  visibleEventItems,
  type EventForm,
  type EventAnswers,
  type EventAnswer,
  type EventIssue,
  type EventQuestion,
} from "@/lib/event-form";
export function EventFormRenderer({
  form,
  answers,
  onChange,
  disabled = false,
  issues = [],
  onUpload,
  itemIds,
}: {
  form: EventForm;
  answers: EventAnswers;
  onChange: (id: string, value: EventAnswer) => void;
  disabled?: boolean;
  issues?: EventIssue[];
  onUpload?: (id: string, file: File) => Promise<void>;
  itemIds?: string[];
}) {
  const scope = useId();
  return (
    <div className="event-form-fields">
      {visibleEventItems(form, answers)
        .filter((q) => !itemIds || itemIds.includes(q.id))
        .map((q) =>
          q.kind === "section" ? (
            <div className="event-section-heading" key={q.id}>
              <h2>{q.title}</h2>
              {q.help && <p>{q.help}</p>}
            </div>
          ) : (
            <EventInput
              key={q.id}
              q={q}
              id={scope + q.id}
              value={answers[q.id]}
              change={(value) => onChange(q.id, value)}
              disabled={disabled}
              issue={issues.find((x) => x.questionId === q.id)?.message}
              onUpload={onUpload}
            />
          ),
        )}
    </div>
  );
}
function EventInput({
  q,
  id,
  value,
  change,
  disabled,
  issue,
  onUpload,
}: {
  q: EventQuestion;
  id: string;
  value?: EventAnswer;
  change: (v: EventAnswer) => void;
  disabled: boolean;
  issue?: string;
  onUpload?: (id: string, file: File) => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false),
    [fileName, setFileName] = useState(""),
    [error, setError] = useState("");
  const selected = Array.isArray(value) ? value : [],
    grid = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const changeList = (list: string[], v: string, checked: boolean) =>
    checked ? [...list.filter((x) => x !== v), v] : list.filter((x) => x !== v);
  const described =
    [q.help ? id + "-help" : "", issue || error ? id + "-error" : ""].filter(Boolean).join(" ") ||
    undefined;
  const control = {
    "aria-label": q.title,
    id,
    disabled,
    "aria-describedby": described,
    "aria-invalid": !!issue,
  };
  let input;
  if (["radio", "checkbox"].includes(q.kind))
    input = (
      <div className="event-choices">
        {q.options.map((o) => (
          <label key={o.id}>
            <input
              type={q.kind === "radio" ? "radio" : "checkbox"}
              name={id}
              checked={q.kind === "radio" ? value === o.id : selected.includes(o.id)}
              disabled={disabled}
              onChange={(e) =>
                change(q.kind === "radio" ? o.id : changeList(selected, o.id, e.target.checked))
              }
            />
            <span>{o.label}</span>
          </label>
        ))}
        {q.other && (
          <label className="event-other">
            <input
              type={q.kind === "radio" ? "radio" : "checkbox"}
              name={id}
              disabled={disabled}
              checked={
                q.kind === "radio"
                  ? typeof value === "string" && value.startsWith("other:")
                  : selected.some((v) => v.startsWith("other:"))
              }
              onChange={(e) =>
                change(
                  q.kind === "radio"
                    ? "other:"
                    : e.target.checked
                      ? [...selected, "other:"]
                      : selected.filter((x) => !x.startsWith("other:")),
                )
              }
            />
            <span>Lainnya:</span>
            <input
              type="text"
              aria-label={q.title + " — jawaban lainnya"}
              maxLength={300}
              disabled={disabled}
              value={
                q.kind === "radio"
                  ? typeof value === "string" && value.startsWith("other:")
                    ? value.slice(6)
                    : ""
                  : (selected.find((v) => v.startsWith("other:"))?.slice(6) ?? "")
              }
              onChange={(e) =>
                change(
                  q.kind === "radio"
                    ? "other:" + e.target.value
                    : [
                        ...selected.filter((x) => !x.startsWith("other:")),
                        "other:" + e.target.value,
                      ],
                )
              }
            />
          </label>
        )}
      </div>
    );
  else if (q.kind === "select")
    input = (
      <select
        {...control}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => change(e.target.value)}
      >
        <option value="">Pilih jawaban</option>
        {q.options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    );
  else if (q.kind.endsWith("Grid"))
    input = (
      <div className="event-grid-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">{q.title}</th>
              {q.options.map((o) => (
                <th key={o.id} scope="col">
                  {o.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {q.gridRows.map((r) => (
              <tr key={r.id}>
                <th scope="row">{r.label}</th>
                {q.options.map((o) => (
                  <td key={o.id}>
                    <input
                      type={q.kind === "radioGrid" ? "radio" : "checkbox"}
                      name={id + r.id}
                      aria-label={r.label + ": " + o.label}
                      disabled={disabled}
                      checked={
                        q.kind === "radioGrid"
                          ? grid[r.id] === o.id
                          : Array.isArray(grid[r.id]) && (grid[r.id] as string[]).includes(o.id)
                      }
                      onChange={(e) =>
                        change({
                          ...grid,
                          [r.id]:
                            q.kind === "radioGrid"
                              ? o.id
                              : changeList(
                                  Array.isArray(grid[r.id]) ? (grid[r.id] as string[]) : [],
                                  o.id,
                                  e.target.checked,
                                ),
                        })
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  else if (q.kind === "paragraph")
    input = (
      <textarea
        {...control}
        rows={4}
        maxLength={q.validation.maxLength ?? 10000}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => change(e.target.value)}
      />
    );
  else if (q.kind === "upload")
    input = (
      <div className="event-file-control">
        <input
          {...control}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          disabled={disabled || uploading || !onUpload}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || !onUpload) return;
            setError("");
            if (file.size > 5 * 1024 * 1024) {
              setError("Berkas maksimal 5 MB.");
              return;
            }
            setUploading(true);
            try {
              await onUpload(q.id, file);
              setFileName(file.name);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Upload gagal.");
            } finally {
              setUploading(false);
            }
          }}
        />
        <p>
          {uploading
            ? "Memeriksa keamanan berkas…"
            : fileName || (value ? "Berkas tersimpan" : "JPG, PNG, WebP atau PDF. Maksimal 5 MB.")}
        </p>
        {value && (
          <button
            type="button"
            className="text-link"
            disabled={disabled || uploading}
            onClick={() => {
              change("");
              setFileName("");
            }}
          >
            Hapus berkas dari jawaban
          </button>
        )}
      </div>
    );
  else if (q.kind === "scale")
    input = (
      <div className="event-scale">
        {Array.from(
          { length: (q.validation.max ?? 5) - (q.validation.min ?? 1) + 1 },
          (_, i) => (q.validation.min ?? 1) + i,
        ).map((n) => (
          <label key={n}>
            {n}
            <input
              type="radio"
              name={id}
              checked={value === n}
              disabled={disabled}
              onChange={() => change(n)}
            />
          </label>
        ))}
      </div>
    );
  else
    input = (
      <input
        {...control}
        type={
          q.kind === "number"
            ? "number"
            : q.kind === "email"
              ? "email"
              : q.kind === "date"
                ? "date"
                : q.kind === "time"
                  ? "time"
                  : "text"
        }
        step={q.kind === "number" ? "any" : undefined}
        min={q.kind === "date" ? q.validation.minDate : q.validation.min}
        max={q.kind === "date" ? q.validation.maxDate : q.validation.max}
        maxLength={q.validation.maxLength ?? 10000}
        value={typeof value === "string" || typeof value === "number" ? value : ""}
        onChange={(e) =>
          change(
            q.kind === "number" && e.target.value !== "" ? Number(e.target.value) : e.target.value,
          )
        }
      />
    );
  return (
    <fieldset className={"event-answer" + (issue || error ? " invalid" : "")}>
      <legend>
        {q.title}
        {q.required && <span className="required"> *</span>}
      </legend>
      {q.help && <p id={id + "-help"}>{q.help}</p>}
      {input}
      {(issue || error) && (
        <p id={id + "-error"} className="field-error" role="alert">
          {issue || error}
        </p>
      )}
    </fieldset>
  );
}
