"use client";
import {
  eventKinds,
  eventKindLabels,
  newEventQuestion,
  type EventQuestion,
} from "@/lib/event-form";
import { Copy, Trash2, ChevronUp, ChevronDown } from "lucide-react";
export function QuestionEditor({
  q,
  prior,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
  disabled = false,
}: {
  q: EventQuestion;
  prior: EventQuestion[];
  onChange: (q: EventQuestion) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (direction: number) => void;
  disabled?: boolean;
}) {
  const choices = ["radio", "checkbox", "select", "radioGrid", "checkboxGrid"].includes(q.kind);
  return (
    <fieldset className="event-question-edit" disabled={disabled}>
      <div className="event-question-head">
        <label>
          Judul pertanyaan
          <input
            aria-label="Judul pertanyaan"
            value={q.title}
            maxLength={300}
            onChange={(e) => onChange({ ...q, title: e.target.value })}
          />
        </label>
        <label>
          Tipe jawaban
          <select
            value={q.kind}
            onChange={(e) => {
              const kind = e.target.value as EventQuestion["kind"];
              const next = newEventQuestion(kind);
              onChange({
                ...next,
                id: q.id,
                title: q.title,
                help: q.help,
                required: kind === "section" ? false : q.required,
                ...(q.showWhen ? { showWhen: q.showWhen } : {}),
              });
            }}
          >
            {eventKinds.map((k) => (
              <option key={k} value={k}>
                {eventKindLabels[k]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Petunjuk / deskripsi
        <textarea
          rows={2}
          value={q.help}
          maxLength={2000}
          onChange={(e) => onChange({ ...q, help: e.target.value })}
        />
      </label>
      {choices && (
        <div className="event-option-editor">
          <p>{q.kind.endsWith("Grid") ? "Kolom pilihan" : "Pilihan jawaban"}</p>
          {q.options.map((o, i) => (
            <div className="event-option-row" key={o.id}>
              <input
                aria-label={"Pilihan " + (i + 1)}
                value={o.label}
                maxLength={300}
                onChange={(e) =>
                  onChange({
                    ...q,
                    options: q.options.map((x) =>
                      x.id === o.id ? { ...x, label: e.target.value } : x,
                    ),
                  })
                }
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={"Hapus pilihan " + (i + 1)}
                onClick={() =>
                  onChange({
                    ...q,
                    options: q.options.filter((x) => x.id !== o.id),
                  })
                }
              >
                <Trash2 size={17} />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Naikkan pilihan"
                disabled={!i}
                onClick={() => {
                  const options = [...q.options];
                  [options[i - 1], options[i]] = [options[i], options[i - 1]];
                  onChange({ ...q, options });
                }}
              >
                <ChevronUp size={17} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-link"
            disabled={q.options.length >= 200}
            onClick={() =>
              onChange({
                ...q,
                options: [
                  ...q.options,
                  {
                    id: crypto.randomUUID(),
                    label: "Pilihan " + (q.options.length + 1),
                  },
                ],
              })
            }
          >
            Tambah pilihan
          </button>
          {["radio", "checkbox"].includes(q.kind) && (
            <label className="event-check">
              <input
                type="checkbox"
                checked={q.other}
                onChange={(e) => onChange({ ...q, other: e.target.checked })}
              />
              Izinkan jawaban lainnya
            </label>
          )}
        </div>
      )}
      {q.kind.endsWith("Grid") && (
        <div className="event-option-editor">
          <p>Baris kisi</p>
          {q.gridRows.map((r, i) => (
            <div className="event-option-row" key={r.id}>
              <input
                aria-label={"Baris kisi " + (i + 1)}
                value={r.label}
                maxLength={300}
                onChange={(e) =>
                  onChange({
                    ...q,
                    gridRows: q.gridRows.map((x) =>
                      x.id === r.id ? { ...x, label: e.target.value } : x,
                    ),
                  })
                }
              />
              <button
                type="button"
                className="icon-btn"
                aria-label="Hapus baris kisi"
                onClick={() =>
                  onChange({
                    ...q,
                    gridRows: q.gridRows.filter((x) => x.id !== r.id),
                  })
                }
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-link"
            onClick={() =>
              onChange({
                ...q,
                gridRows: [
                  ...q.gridRows,
                  {
                    id: crypto.randomUUID(),
                    label: "Baris " + (q.gridRows.length + 1),
                  },
                ],
              })
            }
          >
            Tambah baris
          </button>
        </div>
      )}
      <details className="event-validation">
        <summary>Validasi dan kondisi tampil</summary>
        <div className="event-setting-grid">
          {(["number", "scale"].includes(q.kind)
            ? ["min", "max"]
            : ["checkbox", "checkboxGrid"].includes(q.kind)
              ? ["minChoices", "maxChoices"]
              : ["shortText", "paragraph", "email"].includes(q.kind)
                ? ["minLength", "maxLength"]
                : []
          ).map((key) => (
            <label key={key}>
              {key.startsWith("min") ? "Minimum" : "Maksimum"}
              <input
                type="number"
                value={q.validation[key as keyof typeof q.validation] ?? ""}
                onChange={(e) => {
                  const validation = { ...q.validation };
                  if (e.target.value === "") delete validation[key as keyof typeof validation];
                  else
                    Object.assign(validation, {
                      [key]: Number(e.target.value),
                    });
                  onChange({ ...q, validation });
                }}
              />
            </label>
          ))}
          {q.kind === "date" &&
            (["minDate", "maxDate"] as const).map((key) => (
              <label key={key}>
                {key === "minDate" ? "Tanggal paling awal" : "Tanggal paling akhir"}
                <input
                  type="date"
                  value={q.validation[key] ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...q,
                      validation: { ...q.validation, [key]: e.target.value },
                    })
                  }
                />
              </label>
            ))}
          <label>
            Tampilkan jika
            <select
              value={q.showWhen?.questionId ?? ""}
              onChange={(e) => {
                const parent = prior.find((x) => x.id === e.target.value);
                const next = { ...q };
                delete next.showWhen;
                if (parent?.options[0])
                  next.showWhen = {
                    questionId: parent.id,
                    optionId: parent.options[0].id,
                  };
                onChange(next);
              }}
            >
              <option value="">Selalu tampil</option>
              {prior
                .filter((x) => ["radio", "select", "checkbox"].includes(x.kind))
                .map((x) => (
                  <option value={x.id} key={x.id}>
                    {x.title}
                  </option>
                ))}
            </select>
          </label>
          {q.showWhen && (
            <label>
              Jawaban yang dipilih
              <select
                value={q.showWhen.optionId}
                onChange={(e) =>
                  onChange({
                    ...q,
                    showWhen: {
                      questionId: q.showWhen!.questionId,
                      optionId: e.target.value,
                    },
                  })
                }
              >
                {prior
                  .find((x) => x.id === q.showWhen!.questionId)
                  ?.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>
      </details>
      <div className="event-question-actions">
        <button
          type="button"
          className="icon-btn"
          aria-label="Duplikasi pertanyaan"
          onClick={onDuplicate}
        >
          <Copy size={18} />
        </button>
        <button type="button" className="icon-btn" aria-label="Hapus pertanyaan" onClick={onRemove}>
          <Trash2 size={18} />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Naikkan pertanyaan"
          onClick={() => onMove(-1)}
        >
          <ChevronUp size={18} />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Turunkan pertanyaan"
          onClick={() => onMove(1)}
        >
          <ChevronDown size={18} />
        </button>
        {q.kind !== "section" && (
          <label className="event-check">
            <input
              type="checkbox"
              checked={q.required}
              onChange={(e) => onChange({ ...q, required: e.target.checked })}
            />
            Wajib
          </label>
        )}
      </div>
    </fieldset>
  );
}
