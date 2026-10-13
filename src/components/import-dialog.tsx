"use client";
import { useRef, useState } from "react";
import { useDemo, updateStore } from "@/lib/store";
import { canEdit } from "@/lib/domain";
import type { Role } from "@/lib/types";
import {
  applyImport,
  importFields,
  normalizeImportHeader,
  validateImport,
  type ImportKind,
  type ImportTable,
} from "@/lib/import-data";
import { downloadImportTemplate, readImportFile } from "@/lib/import-files";
import { Modal, Notice } from "./ui";
import { useToast } from "./providers";
export function ImportDialog({ kind, role }: { kind: ImportKind; role: Role }) {
  const state = useDemo(),
    toast = useToast();
  const [open, setOpen] = useState(false),
    [table, setTable] = useState<ImportTable | null>(null),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false);
  const request = useRef(0);
  const preview = table ? validateImport(kind, table, mapping, state) : null;
  const close = () => {
    request.current++;
    setOpen(false);
    setTable(null);
    setConfirm(false);
    setBusy(false);
    setError("");
  };
  if (!canEdit(role, kind)) return null;
  return (
    <>
      <button
        className="btn secondary"
        onClick={() => {
          setOpen(true);
          setTable(null);
          setMapping({});
          setError("");
        }}
      >
        Impor {kind === "anggota" ? "anggota" : "inventaris"}
      </button>
      <Modal open={open} title={"Impor " + kind} onClose={close}>
        <Notice>
          Preview lokal: gunakan file fiktif. Data yang diterapkan tersimpan
          pada browser ini, bukan penyimpanan produksi yang aman. Jangan impor
          dokumen pribadi untuk pengujian UI.
        </Notice>
        <button
          type="button"
          className="text-link"
          onClick={() =>
            void downloadImportTemplate(kind).catch(() =>
              setError("Template gagal diunduh."),
            )
          }
        >
          Unduh template CSV
        </button>
        <div className="field">
          <label htmlFor={"import-" + kind}>File CSV / XLSX</label>
          <input
            id={"import-" + kind}
            type="file"
            accept=".csv,.xlsx"
            onChange={async (e) => {
              const file = e.target.files?.[0],
                token = ++request.current;
              setTable(null);
              setConfirm(false);
              setError("");
              if (!file) return;
              setBusy(true);
              try {
                const next = await readImportFile(file);
                if (token !== request.current) return;
                setTable(next);
                setMapping(
                  Object.fromEntries(
                    importFields[kind].map((key) => [
                      key,
                      next.headers.find(
                        (h) =>
                          normalizeImportHeader(h) ===
                          normalizeImportHeader(key),
                      ) || "",
                    ]),
                  ),
                );
              } catch (err) {
                if (token === request.current)
                  setError(
                    err instanceof Error ? err.message : "File tidak terbaca.",
                  );
              } finally {
                if (token === request.current) setBusy(false);
              }
            }}
          />
          <p className="field-hint">
            Maksimal 10 MB, 2.000 baris. Formula dan makro tidak diterima.
          </p>
        </div>
        {busy && <p role="status">Membaca dan memeriksa file…</p>}
        {error && <Notice tone="error">{error}</Notice>}
        {table && preview && (
          <>
            <h3>Petakan kolom</h3>
            <div className="form-grid">
              {importFields[kind].map((key) => (
                <div className="field" key={key}>
                  <label htmlFor={"map-" + key}>{key}</label>
                  <select
                    id={"map-" + key}
                    value={mapping[key] || ""}
                    onChange={(e) => {
                      setMapping({ ...mapping, [key]: e.target.value });
                      setConfirm(false);
                    }}
                  >
                    <option value="">Tidak dipetakan</option>
                    {table.headers.map((h, i) => (
                      <option key={i} value={h}>
                        {h || "(Kolom kosong)"}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <h3>Preview {preview.rows.length} baris</h3>
            <div className="table-wrap import-preview">
              <table>
                <thead>
                  <tr>
                    {importFields[kind].map((k) => (
                      <th key={k}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 10).map((r, i) => (
                    <tr key={i}>
                      {importFields[kind].map((k) => (
                        <td key={k}>{r[k] || "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="field-hint">
              Menampilkan maksimal 10 baris. Seluruh baris tetap diperiksa.
            </p>
            {preview.errors.length ? (
              <Notice tone="error">
                <strong>
                  {preview.errors.length} error — penerapan diblokir.
                </strong>
                <ul>
                  {preview.errors.slice(0, 20).map((e, i) => (
                    <li key={i}>
                      Baris {e.row}, {e.field}: {e.message}
                    </li>
                  ))}
                </ul>
                {preview.errors.length > 20 && (
                  <p>
                    Perbaiki error di file sumber, lalu unggah kembali untuk
                    memeriksa semua baris.
                  </p>
                )}
              </Notice>
            ) : (
              <Notice>
                {preview.rows.length} baris valid. Data lama tidak ditimpa;
                konflik akan diperiksa kembali saat penerapan.
              </Notice>
            )}
            {!preview.errors.length && preview.rows.length > 0 && (
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={confirm}
                  onChange={(e) => setConfirm(e.target.checked)}
                />
                Saya telah memeriksa preview dan setuju menambah{" "}
                {preview.rows.length} record contoh.
              </label>
            )}
            <div className="button-row">
              <button
                className="btn primary"
                disabled={!confirm || !!preview.errors.length}
                onClick={() => {
                  const batch = preview;
                  if (!batch) return;
                  try {
                    updateStore(
                      (d) => applyImport(d, kind, batch),
                      "Impor " + kind,
                      batch.rows.length + " baris",
                      role,
                    );
                    toast("Impor tersimpan: " + batch.rows.length + " record.");
                    close();
                  } catch (err) {
                    setConfirm(false);
                    setError(
                      err instanceof Error ? err.message : "Impor gagal.",
                    );
                  }
                }}
              >
                Terapkan impor
              </button>
              <button className="btn secondary" onClick={close}>
                Batal
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
