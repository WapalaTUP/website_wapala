"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { BackendRecord } from "../backend/records";
import { backendApi, uploadMedia } from "../backend/api";
import { Field, Notice, Textarea } from "../ui";
import { articleBlocksSchema, parseArticleBlocks, type ArticleBlock } from "@/lib/article-content";
import { contentSlug } from "@/lib/content-slug";
import { CONTENT_TAGS, parseContentTags } from "@/lib/content-tags";
import { ArticleBody } from "./article-body";
import styles from "./articles.module.css";

const blockNames: Record<ArticleBlock["type"], string> = {
  paragraph: "Paragraf",
  heading: "Subjudul",
  quote: "Kutipan",
  list: "Daftar",
  image: "Gambar",
  video: "Video",
};
const workflowNames: Record<string, string> = {
  draft: "Draf",
  submitted: "Menunggu tinjauan",
  returned: "Perlu revisi",
  published: "Terbit",
};

function ArticleTextInput({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  function format(open: string, close: string) {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart,
      end = input.selectionEnd;
    const selected = value.slice(start, end) || "teks";
    onChange(value.slice(0, start) + open + selected + close + value.slice(end));
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + open.length, start + open.length + selected.length);
    });
  }
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={styles.formatToolbar} role="toolbar" aria-label="Format teks">
        <button type="button" title="Tebal" onClick={() => format("**", "**")}>
          <strong>B</strong>
        </button>
        <button type="button" title="Miring" onClick={() => format("*", "*")}>
          <em>I</em>
        </button>
        <button type="button" onClick={() => format("[", "](https://contoh.id)")}>
          Tautan
        </button>
      </div>
      <textarea
        id={id}
        ref={inputRef}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function ArticleEditor({
  initial,
  csrfToken,
  onSaved,
  onClose,
  memberMode = false,
}: {
  initial: BackendRecord | null;
  csrfToken: string;
  onSaved: () => void | Promise<void>;
  onClose: () => void;
  memberMode?: boolean;
}) {
  const [fields, setFields] = useState<BackendRecord["fields"]>(() => ({
    tipe: "Berita",
    tanggal: "",
    ...initial?.fields,
    tags: parseContentTags(initial?.fields.tags),
  }));
  const [blocks, setBlocks] = useState<ArticleBlock[]>(() =>
    parseArticleBlocks(initial?.fields || {}),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [preview, setPreview] = useState(false),
    [note, setNote] = useState("");
  const initialSnapshot = useRef(JSON.stringify({ fields, blocks }));
  const dirty = JSON.stringify({ fields, blocks }) !== initialSnapshot.current;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const value = (key: string) => String(fields[key] || "");
  const change = (key: string, value: string | string[]) =>
    setFields((current) => ({ ...current, [key]: value }));
  function updateBlock(id: string, updates: Partial<ArticleBlock>) {
    setBlocks((current) =>
      current.map((block) => (block.id === id ? { ...block, ...updates } : block)),
    );
  }
  function moveBlock(index: number, direction: number) {
    setBlocks((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  async function upload(file: File, onUrl: (url: string) => void, video = false) {
    if (busy) return;
    if (
      video
        ? file.type !== "video/mp4" || file.size > 50 * 1024 * 1024
        : !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 5 * 1024 * 1024
    ) {
      setError(
        video
          ? "Gunakan video MP4 maksimal 50 MB."
          : "Gunakan gambar JPG, PNG, atau WebP maksimal 5 MB.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      onUrl(await uploadMedia(file, video ? "content-video" : "content", csrfToken));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unggahan gagal.");
    } finally {
      setBusy(false);
    }
  }
  async function save(action: "save" | "submit" | "publish" | "return" | "unpublish") {
    if (busy) return;
    setError("");
    const parsed = articleBlocksSchema.safeParse(blocks);
    if (!parsed.success) {
      setError("Lengkapi atau hapus blok media yang belum memiliki gambar/video valid.");
      return;
    }
    if (!value("judul").trim()) {
      setError("Judul artikel wajib diisi.");
      return;
    }
    if (action === "return" && !note.trim()) {
      setError("Tuliskan catatan revisi sebelum mengembalikan artikel.");
      return;
    }
    setBusy(true);
    try {
      await backendApi(
        memberMode ? "/api/member/articles" : "/api/admin/records/konten",
        csrfToken,
        {
          ...(initial ? { id: initial.id, version: initial.version } : {}),
          action,
          ...(action === "return" ? { note } : {}),
          fields: {
            ...fields,
            slug: contentSlug(value("slug") || value("judul")),
            tags: parseContentTags(fields.tags),
            bloki: JSON.stringify(parsed.data),
            isi: blocks
              .filter((block) => !["image", "video"].includes(block.type))
              .map((block) => block.text || "")
              .join("\n\n"),
          },
        },
      );
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Artikel belum tersimpan.");
    } finally {
      setBusy(false);
    }
  }
  const status =
    initial?.workflowStatus || (initial?.fields.status === "Publik" ? "published" : "draft");
  const readOnly = memberMode && status === "submitted";
  return (
    <section className={styles.editor} aria-label="Editor artikel">
      <header className={styles.editorHeader}>
        <div>
          <p className="eyebrow">RUANG REDAKSI</p>
          <h2>{initial ? "Sunting artikel" : "Tulis artikel"}</h2>
          <p>{workflowNames[status] || status}</p>
        </div>
        <div className="button-row">
          <button className="btn secondary" disabled={busy} onClick={() => setPreview(!preview)}>
            {preview ? "Kembali menyunting" : "Pratinjau"}
          </button>
          <button
            className="btn secondary"
            disabled={busy}
            onClick={() => {
              if (!dirty || window.confirm("Tutup editor dan buang perubahan yang belum disimpan?"))
                onClose();
            }}
          >
            Tutup editor
          </button>
        </div>
      </header>
      {initial?.reviewNote && <Notice>Catatan redaksi: {initial.reviewNote}</Notice>}
      {readOnly && (
        <Notice>
          Artikel sedang ditinjau redaksi. Penyuntingan tersedia kembali setelah artikel
          dikembalikan.
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save("save");
        }}
      >
        <fieldset
          disabled={busy || readOnly}
          style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
        >
          {!preview && (
            <div className={styles.editorGrid}>
              <div className={styles.editorMain}>
                <div className={`${styles.panel} ${styles.editorTitle}`}>
                  <Field
                    label="Judul artikel"
                    value={value("judul")}
                    required
                    onChange={(event) => change("judul", event.target.value)}
                  />
                  <Textarea
                    label="Ringkasan / pengantar"
                    value={value("ringkasan")}
                    rows={3}
                    onChange={(text) => change("ringkasan", text)}
                  />
                </div>
                <div className={styles.panel}>
                  <h3>Isi artikel</h3>
                  <p className={styles.hint}>
                    Gunakan **tebal**, *miring*, atau [teks tautan](https://contoh.id). Setiap baris
                    pada blok daftar menjadi satu butir.
                  </p>
                  <div className={styles.blocks}>
                    {blocks.map((block, index) => (
                      <section
                        className={styles.block}
                        key={block.id}
                        aria-label={`${blockNames[block.type]} ${index + 1}`}
                      >
                        <header className={styles.blockHeader}>
                          <strong>
                            {index + 1}. {blockNames[block.type]}
                          </strong>
                          <div className={styles.blockActions}>
                            <button
                              type="button"
                              title="Pindah ke atas"
                              aria-label={`Pindahkan blok ${index + 1} ke atas`}
                              disabled={index === 0}
                              onClick={() => moveBlock(index, -1)}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              title="Pindah ke bawah"
                              aria-label={`Pindahkan blok ${index + 1} ke bawah`}
                              disabled={index === blocks.length - 1}
                              onClick={() => moveBlock(index, 1)}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setBlocks((current) =>
                                  current.filter((entry) => entry.id !== block.id),
                                )
                              }
                            >
                              Hapus
                            </button>
                          </div>
                        </header>
                        {block.type === "image" || block.type === "video" ? (
                          <>
                            <label>
                              {block.type === "image" ? "Unggah gambar" : "Unggah video (opsional)"}
                              <input
                                type="file"
                                accept={
                                  block.type === "image"
                                    ? "image/jpeg,image/png,image/webp"
                                    : "video/mp4"
                                }
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  if (file)
                                    void upload(
                                      file,
                                      (src) => updateBlock(block.id, { src }),
                                      block.type === "video",
                                    );
                                  event.target.value = "";
                                }}
                              />
                            </label>
                            {block.type === "video" && (
                              <Field
                                label="Atau tautan Instagram / TikTok / YouTube / Vimeo"
                                value={block.src || ""}
                                onChange={(event) =>
                                  updateBlock(block.id, { src: event.target.value })
                                }
                              />
                            )}
                            {block.src && <p className={styles.hint}>Media dipilih: {block.src}</p>}
                            {block.type === "image" && (
                              <Field
                                label="Teks alternatif gambar"
                                value={block.alt || ""}
                                onChange={(event) =>
                                  updateBlock(block.id, { alt: event.target.value })
                                }
                              />
                            )}
                            <Field
                              label="Keterangan"
                              value={block.caption || ""}
                              onChange={(event) =>
                                updateBlock(block.id, { caption: event.target.value })
                              }
                            />
                            <Field
                              label="Kredit / sumber"
                              value={block.credit || ""}
                              onChange={(event) =>
                                updateBlock(block.id, { credit: event.target.value })
                              }
                            />
                          </>
                        ) : (
                          <ArticleTextInput
                            label={blockNames[block.type]}
                            rows={block.type === "heading" ? 2 : 5}
                            value={block.text || ""}
                            onChange={(text) => updateBlock(block.id, { text })}
                          />
                        )}
                      </section>
                    ))}
                  </div>
                  {!blocks.length && (
                    <p className={styles.hint}>Mulai tulisan dengan menambahkan paragraf.</p>
                  )}
                  <div className={styles.addBlocks}>
                    {(Object.keys(blockNames) as ArticleBlock["type"][]).map((type) => (
                      <button
                        type="button"
                        key={type}
                        onClick={() =>
                          setBlocks((current) => [
                            ...current,
                            {
                              id: crypto.randomUUID(),
                              type,
                              ...(["image", "video"].includes(type) ? { src: "" } : { text: "" }),
                            },
                          ])
                        }
                      >
                        + {blockNames[type]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <aside className={styles.sidebar}>
                <div className={styles.panel}>
                  <h3>Informasi artikel</h3>
                  <Field
                    label="Penulis"
                    readOnly={memberMode}
                    placeholder={memberMode ? "Nama akun anggota diisi otomatis" : undefined}
                    hint={memberMode ? "Nama penulis mengikuti akun anggota." : undefined}
                    value={value("penulis")}
                    onChange={(event) => change("penulis", event.target.value)}
                  />
                  <Field
                    label="Tanggal terbit"
                    type="date"
                    value={value("tanggal")}
                    onChange={(event) => change("tanggal", event.target.value)}
                  />
                  <label>
                    Jenis
                    <select
                      value={value("tipe")}
                      onChange={(event) => change("tipe", event.target.value)}
                    >
                      <option>Berita</option>
                      {!memberMode && <option>Announcement</option>}
                    </select>
                  </label>
                  <Field
                    label="Slug (opsional)"
                    value={value("slug")}
                    placeholder="Otomatis dari judul"
                    onChange={(event) => change("slug", event.target.value)}
                  />
                </div>
                <div className={styles.panel}>
                  <fieldset className={styles.tagChoices}>
                    <legend>Tag</legend>
                    {CONTENT_TAGS.map((tag) => (
                      <label key={tag}>
                        <input
                          type="checkbox"
                          checked={parseContentTags(fields.tags).includes(tag)}
                          onChange={(event) =>
                            change(
                              "tags",
                              event.target.checked
                                ? [...parseContentTags(fields.tags), tag]
                                : parseContentTags(fields.tags).filter((entry) => entry !== tag),
                            )
                          }
                        />
                        {tag}
                      </label>
                    ))}
                  </fieldset>
                </div>
                <div className={styles.panel}>
                  <h3>Foto sampul</h3>
                  {value("sampul") && (
                    <img
                      className={styles.coverPreview}
                      src={value("sampul")}
                      alt="Pratinjau sampul"
                    />
                  )}
                  <label>
                    Unggah sampul
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void upload(file, (url) => change("sampul", url));
                        event.target.value = "";
                      }}
                    />
                  </label>
                  {value("sampul") && (
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => change("sampul", "")}
                    >
                      Hapus sampul
                    </button>
                  )}
                  <Field
                    label="Keterangan sampul"
                    value={value("sampul_caption")}
                    onChange={(event) => change("sampul_caption", event.target.value)}
                  />
                  <Field
                    label="Kredit sampul"
                    value={value("sampul_credit")}
                    onChange={(event) => change("sampul_credit", event.target.value)}
                  />
                </div>
              </aside>
            </div>
          )}
          {preview && (
            <div className={styles.preview}>
              <h1>{value("judul") || "Judul artikel"}</h1>
              <p className={styles.previewDeck}>{value("ringkasan")}</p>
              <p className={styles.previewByline}>
                Oleh <strong>{value("penulis") || "Penulis WAPALA"}</strong>
                {value("tanggal") && (
                  <>
                    {" "}
                    ·{" "}
                    <time dateTime={value("tanggal")}>
                      {new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(
                        new Date(value("tanggal") + "T00:00:00"),
                      )}
                    </time>
                  </>
                )}
              </p>
              {value("sampul") && (
                <figure className={styles.previewCover}>
                  <img src={value("sampul")} alt={value("sampul_caption") || value("judul")} />
                  <figcaption>
                    {value("sampul_caption")}
                    <span className={styles.credit}>{value("sampul_credit")}</span>
                  </figcaption>
                </figure>
              )}
              <ArticleBody fields={{ ...fields, isi: "", bloki: JSON.stringify(blocks) }} />
            </div>
          )}
          <div className={`${styles.panel} button-row`} style={{ marginTop: 24 }}>
            <button className="btn primary" type="submit">
              {busy ? "Memproses…" : "Simpan draf"}
            </button>
            {memberMode ? (
              <button className="btn secondary" type="button" onClick={() => void save("submit")}>
                Kirim ke redaksi
              </button>
            ) : (
              <>
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => void save("publish")}
                >
                  Terbitkan
                </button>
                {(initial?.published || status === "published") && (
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() => void save("unpublish")}
                  >
                    Tarik dari publik
                  </button>
                )}
              </>
            )}
          </div>
          {!memberMode && initial?.authorId && (
            <div className={styles.panel}>
              <Textarea label="Catatan untuk penulis" value={note} onChange={setNote} />
              <button className="btn secondary" type="button" onClick={() => void save("return")}>
                Kembalikan untuk revisi
              </button>
            </div>
          )}
        </fieldset>
      </form>
    </section>
  );
}
