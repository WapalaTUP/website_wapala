"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Plus, Eye, Save, Upload, ArrowLeft, GripVertical } from "lucide-react";
import {
  eventDraftSchema,
  blankEvent,
  type EventDraft,
  type EventAdminDto,
} from "@/lib/event-types";
import {
  newEventQuestion,
  duplicateQuestion,
  eventKindLabels,
  type EventAnswers,
  type EventForm,
} from "@/lib/event-form";
import { backendApi, uploadMedia } from "../backend/api";
import { Notice } from "../ui";
import { QuestionEditor } from "./question-editor";
import { EventFormRenderer } from "./form-renderer";
import { EventResponses } from "./event-responses";
import "./event-media.css";
const localTime = (iso: string) =>
  iso ? new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 16) : "";
export function EventEditor({
  initial,
  csrfToken,
  onSaved,
  onClose,
}: {
  initial: EventAdminDto | null;
  csrfToken: string;
  onSaved: (event: EventAdminDto) => void;
  onClose: () => void;
}) {
  const [record, setRecord] = useState(initial),
    [draft, setDraft] = useState<EventDraft>(initial?.draft ?? blankEvent()),
    [tab, setTab] = useState("questions"),
    [preview, setPreview] = useState(false),
    [mobile, setMobile] = useState(false),
    [previewAnswers, setPreviewAnswers] = useState<EventAnswers>({}),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [selected, setSelected] = useState(""),
    [drag, setDrag] = useState("");
  const busyRef = useRef(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const patch = (v: Partial<EventDraft>) => {
    setDraft((d) => ({ ...d, ...v }));
    setDirty(true);
    setMessage("");
  };
  const form = (v: EventForm) => patch({ form: v });
  const close = () => {
    if (!dirty || window.confirm("Ada perubahan belum tersimpan. Tinggalkan editor?")) onClose();
  };
  async function save(publish = false) {
    if (busyRef.current) return;
    if (
      publish &&
      !window.confirm(
        "Publikasikan versi ini? Pertanyaan yang berubah makna akan memiliki ID baru. Jawaban lama tetap tersimpan.",
      )
    )
      return;
    setError("");
    setMessage("");
    const checked = eventDraftSchema.safeParse(draft);
    if (!checked.success) {
      setError(checked.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("\n"));
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const saved = await backendApi<EventAdminDto>("/api/admin/events", csrfToken, {
        ...checked.data,
        ...(record ? { id: record.id, version: record.version } : {}),
      });
      setRecord(saved);
      setDraft(saved.draft);
      setDirty(false);
      onSaved(saved);
      setMessage("Draft tersimpan.");
      if (publish) {
        const live = await backendApi<EventAdminDto>("/api/admin/events/action", csrfToken, {
          id: saved.id,
          version: saved.version,
          action: "publish",
        });
        setRecord(live);
        onSaved(live);
        setMessage("Event dipublikasikan. Formulir siap menerima pendaftaran.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Event belum dapat disimpan.");
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }
  function move(id: string, index: number) {
    const items = [...draft.form.items],
      from = items.findIndex((x) => x.id === id);
    if (from < 0 || index < 0 || index >= items.length) return;
    const [item] = items.splice(from, 1);
    items.splice(index, 0, item);
    form({ ...draft.form, items });
  }
  function add(section = false) {
    if (draft.form.items.length >= 200) {
      setError("Maksimal 200 pertanyaan/bagian per formulir.");
      return;
    }
    const q = newEventQuestion(section ? "section" : "shortText");
    form({ ...draft.form, items: [...draft.form.items, q] });
    setSelected(q.id);
  }
  function template() {
    if (
      draft.form.items.length &&
      !window.confirm(
        "Ganti pertanyaan draft dengan template awal? Respons versi lama tidak dihapus.",
      )
    )
      return;
    const titles = [
      "Nama Lengkap",
      "NIM",
      "Program Studi",
      "Nomor WhatsApp Aktif",
      "Status Saat Ini",
      "Darimana mendapat informasi kegiatan?",
    ];
    const items = titles.map((title) => ({ ...newEventQuestion(), title }));
    items[4] = {
      ...newEventQuestion("radio"),
      title: titles[4],
      options: ["Mahasiswa", "Alumni", "Umum"].map((label) => ({
        id: crypto.randomUUID(),
        label,
      })),
    };
    form({ ...draft.form, items });
  }
  return (
    <fieldset className="event-editor-lock" disabled={busy}>
      <div className="event-workspace">
        <div className="event-editor-top">
          <button className="text-link" onClick={close} disabled={busy}>
            <ArrowLeft size={17} />
            Daftar event
          </button>
          <span role="status">
            {dirty ? "Perubahan belum tersimpan" : record ? "Draft tersimpan" : "Event baru"}
          </span>
          <div className="event-editor-tools">
            <button className="btn secondary" onClick={() => setPreview(!preview)}>
              <Eye size={17} />
              {preview ? "Kembali mengedit" : "Preview"}
            </button>
            <button className="btn secondary" disabled={busy} onClick={() => save()}>
              <Save size={17} />
              Simpan draft
            </button>
            <button className="btn primary" disabled={busy} onClick={() => save(true)}>
              Publikasikan
            </button>
          </div>
        </div>
        <div className="event-tabs" role="tablist" aria-label="Editor formulir event">
          {[
            ["questions", "Pertanyaan"],
            ["responses", "Respons"],
            ["settings", "Pengaturan"],
          ].map(([key, label]) => (
            <button
              role="tab"
              key={key}
              aria-selected={tab === key}
              onClick={() => {
                setTab(key);
                setPreview(false);
              }}
            >
              {label}
              {key === "responses" && record ? " (" + record.registrationCount + ")" : ""}
            </button>
          ))}
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        {message && <Notice tone="success">{message}</Notice>}
        {preview ? (
          <div className={"event-preview" + (mobile ? " mobile" : "")}>
            <div className="event-preview-tools">
              <span>Preview, tidak mengirim pendaftaran.</span>
              <button className="text-link" onClick={() => setMobile(!mobile)}>
                {mobile ? "Desktop" : "Mobile"}
              </button>
            </div>
            {draft.cover && (
              <Image
                src={draft.cover}
                width={1600}
                height={560}
                className="event-registration-cover"
                alt="Sampul formulir pendaftaran"
                unoptimized
              />
            )}
            <h2>{draft.form.title}</h2>
            <p>{draft.form.description}</p>
            <EventFormRenderer
              form={draft.form}
              answers={previewAnswers}
              onChange={(id, v) => setPreviewAnswers((a) => ({ ...a, [id]: v }))}
            />
          </div>
        ) : tab === "responses" ? (
          record ? (
            <EventResponses eventId={record.id} csrfToken={csrfToken} />
          ) : (
            <Notice>Simpan event dahulu untuk melihat respons.</Notice>
          )
        ) : tab === "settings" ? (
          <div className="event-canvas event-settings">
            <h2>Informasi kegiatan</h2>
            <div className="event-setting-grid">
              <label>
                Nama event
                <input
                  value={draft.title}
                  maxLength={200}
                  onChange={(e) => patch({ title: e.target.value })}
                />
              </label>
              <label>
                Lokasi (opsional)
                <input
                  value={draft.location}
                  maxLength={300}
                  onChange={(e) => patch({ location: e.target.value })}
                />
              </label>
              <label>
                Jadwal kegiatan (WIB)
                <input
                  type="datetime-local"
                  value={localTime(draft.eventAt)}
                  onChange={(e) =>
                    patch({
                      eventAt: e.target.value
                        ? new Date(e.target.value + ":00+07:00").toISOString()
                        : "",
                    })
                  }
                />
              </label>
              <label>
                Kuota (kosong = tanpa batas)
                <input
                  type="number"
                  min={1}
                  max={1000000}
                  value={draft.quota ?? ""}
                  onChange={(e) =>
                    patch({
                      quota: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </label>
              <label>
                Pendaftaran mulai (WIB)
                <input
                  type="datetime-local"
                  value={localTime(draft.start)}
                  onChange={(e) =>
                    patch({
                      start: e.target.value
                        ? new Date(e.target.value + ":00+07:00").toISOString()
                        : "",
                    })
                  }
                />
              </label>
              <label>
                Pendaftaran selesai (WIB)
                <input
                  type="datetime-local"
                  value={localTime(draft.end)}
                  onChange={(e) =>
                    patch({
                      end: e.target.value
                        ? new Date(e.target.value + ":00+07:00").toISOString()
                        : "",
                    })
                  }
                />
              </label>
            </div>
            <label>
              Keterangan kegiatan
              <textarea
                rows={5}
                value={draft.description}
                maxLength={10000}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </label>
            <div className="event-setting-grid">
              {(["poster", "cover"] as const).map((key) => (
                <div key={key}>
                  <label className="event-upload-label">
                    <Upload size={18} />
                    {key === "poster" ? "Upload poster event" : "Upload foto sampul"}
                    <input
                      type="file"
                      disabled={busy}
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setBusy(true);
                        try {
                          patch({
                            [key]: await uploadMedia(file, "event-" + key, csrfToken),
                          });
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Upload gagal.");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    />
                  </label>
                  <p className="field-hint">
                    {key === "poster"
                      ? "Poster tampil pada informasi kegiatan."
                      : "Banner lebar di atas formulir pendaftaran. Disarankan rasio 3:1."}
                  </p>
                  {draft[key] && (
                    <>
                      <a
                        className={"event-media-preview is-" + key}
                        href={draft[key]}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Image
                          src={draft[key]}
                          width={320}
                          height={180}
                          alt={key === "poster" ? "Poster event" : "Sampul event"}
                          unoptimized
                        />
                        <span>Lihat ukuran penuh</span>
                      </a>
                      <button className="text-link" onClick={() => patch({ [key]: "" })}>
                        Hapus gambar
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="event-editor-layout">
            <div className="event-canvas">
              <div className="event-form-heading">
                <label>
                  Judul formulir
                  <input
                    value={draft.form.title}
                    maxLength={200}
                    onChange={(e) => form({ ...draft.form, title: e.target.value })}
                  />
                </label>
                <label>
                  Deskripsi formulir
                  <textarea
                    rows={2}
                    value={draft.form.description}
                    maxLength={10000}
                    onChange={(e) => form({ ...draft.form, description: e.target.value })}
                  />
                </label>
              </div>
              {!draft.form.items.length && (
                <div className="event-empty-form">
                  <h2>Mulai dengan pertanyaanmu.</h2>
                  <p>
                    Semua pertanyaan opsional secara default. Aktifkan Wajib hanya jika diperlukan.
                  </p>
                  <button className="btn secondary" onClick={template}>
                    Gunakan template WAPALA
                  </button>
                </div>
              )}
              {draft.form.items.map((q, i) => (
                <article
                  key={q.id}
                  className={"event-question" + (selected === q.id ? " selected" : "")}
                  onFocus={() => setSelected(q.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    move(drag, i);
                    setDrag("");
                  }}
                >
                  <button
                    className="event-drag-handle"
                    draggable
                    onDragStart={() => setDrag(q.id)}
                    aria-label="Seret untuk memindahkan pertanyaan"
                  >
                    <GripVertical size={18} />
                  </button>
                  <QuestionEditor
                    q={q}
                    prior={draft.form.items.slice(0, i)}
                    onChange={(next) =>
                      form({
                        ...draft.form,
                        items: draft.form.items.map((x) => (x.id === q.id ? next : x)),
                      })
                    }
                    onDuplicate={() => form(duplicateQuestion(draft.form, q.id))}
                    onRemove={() => {
                      if (draft.form.items.some((x) => x.showWhen?.questionId === q.id)) {
                        setError(
                          "Pertanyaan ini dipakai sebagai kondisi. Hapus kondisi terkait dahulu.",
                        );
                        return;
                      }
                      form({
                        ...draft.form,
                        items: draft.form.items.filter((x) => x.id !== q.id),
                      });
                    }}
                    onMove={(direction) => move(q.id, i + direction)}
                  />
                </article>
              ))}
            </div>
            <aside className="event-builder-toolbar" aria-label="Tambah isi formulir">
              <button title="Tambah pertanyaan" onClick={() => add()}>
                <Plus size={22} />
                <span>Tambah pertanyaan</span>
              </button>
              <button onClick={() => add(true)}>Tambah bagian</button>
              <button onClick={template}>Template awal</button>
              <p>{draft.form.items.length} / 200</p>
              <small>
                {selected
                  ? eventKindLabels[
                      draft.form.items.find((q) => q.id === selected)?.kind ?? "shortText"
                    ]
                  : "Pilih pertanyaan untuk mengedit."}
              </small>
            </aside>
          </div>
        )}
      </div>
    </fieldset>
  );
}
