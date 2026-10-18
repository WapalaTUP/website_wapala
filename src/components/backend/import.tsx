"use client";
import { useId, useState } from "react";
import { FileSpreadsheet, UploadCloud, CheckCircle2, AlertCircle } from "lucide-react";
import {
  importFields,
  normalizeImportHeader,
  type ImportKind,
  type ImportTable,
} from "@/lib/import-data";
import { readImportFile, downloadImportTemplate } from "@/lib/import-files";
import {
  prepareBackendImport,
  importLabels,
  requiredImportFields,
  type ImportIssue,
} from "@/lib/backend-import";
import { Modal, Notice, Empty } from "../ui";
import { backendApi } from "./api";
type Preview = ReturnType<typeof prepareBackendImport>;
export function BackendImportPreview({
  kind,
  result,
  busy,
  onSubmit,
}: {
  kind: ImportKind;
  result: Preview;
  busy: boolean;
  onSubmit: () => void;
}) {
  const columns =
    kind === "anggota"
      ? ["nomor", "nama", "nim", "nia", "angkatan", "angkatan_wapala", "status", "kontak"]
      : ["code", "name", "typeColor", "category", "total", "fit", "condition"];
  const invalid = new Set(result.errors.map((e) => e.row));
  return (
    <section className="import-preview" aria-label="Hasil validasi impor">
      <div className="import-preview-heading">
        <h3>Hasil pemeriksaan</h3>
        <span className={result.errors.length ? "import-status is-error" : "import-status"}>
          {result.errors.length ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          {result.errors.length ? result.errors.length + " masalah" : "Valid"}
        </span>
      </div>
      <p>{result.displayRows.length} baris data diperiksa. Header dihitung sebagai baris 1.</p>
      {result.errors.length > 0 && (
        <div className="import-issues" role="alert">
          <p>Perbaiki data atau pemetaan berikut sebelum impor. Tidak ada data yang disimpan.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Baris</th>
                  <th>Kolom</th>
                  <th>Masalah</th>
                </tr>
              </thead>
              <tbody>
                {result.errors.slice(0, 100).map((e, i) => (
                  <tr key={i}>
                    <td>{e.row}</td>
                    <td>{importLabels[e.field] || e.field}</td>
                    <td>{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.errors.length > 100 && (
            <p>
              Menampilkan 100 dari {result.errors.length} masalah. Perbaiki berkas lalu periksa
              kembali.
            </p>
          )}
        </div>
      )}
      <div className="table-wrap import-data-preview">
        <table>
          <caption>Preview 10 baris pertama dari {result.displayRows.length} baris</caption>
          <thead>
            <tr>
              <th>Baris CSV</th>
              {columns.map((key) => (
                <th key={key}>{importLabels[key]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.displayRows.slice(0, 10).map((row, i) => (
              <tr key={i} className={invalid.has(i + 2) ? "import-row-invalid" : undefined}>
                <td>{i + 2}</td>
                {columns.map((key) => (
                  <td key={key}>{row[key] || "Belum tersedia"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="import-submit">
        <div>
          <p>Impor hanya menambah data baru. Batch bermasalah ditolak seluruhnya.</p>
          {kind === "inventaris" && (
            <p>
              Alat hasil impor langsung tersedia pada katalog peminjaman. Ketersediaan dapat diubah
              oleh pengelola inventaris.
            </p>
          )}
        </div>
        <button
          className="btn primary"
          disabled={busy || !!result.errors.length || !result.rows.length}
          onClick={onSubmit}
        >
          {busy ? "Memvalidasi dan menyimpan…" : "Impor " + result.rows.length + " baris"}
        </button>
      </div>
    </section>
  );
}
export function BackendImport({
  kind,
  csrfToken,
  onImported,
}: {
  kind: ImportKind;
  csrfToken: string;
  onImported: () => Promise<void>;
}) {
  const fileId = useId();
  const [open, setOpen] = useState(false),
    [table, setTable] = useState<ImportTable | null>(null),
    [fileName, setFileName] = useState(""),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [preview, setPreview] = useState<Preview | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState<number | null>(null);
  async function submit() {
    if (!preview || preview.errors.length || busy || success !== null) return;
    setBusy(true);
    setError("");
    try {
      const result = await backendApi<{ imported: number }>(
        "/api/admin/" + (kind === "anggota" ? "members" : "inventory") + "/import",
        csrfToken,
        { rows: preview.rows },
      );
      setSuccess(result.imported);
      try {
        await onImported();
      } catch {
        setError(
          "Impor berhasil disimpan, tetapi daftar belum dimuat ulang. Tutup panel dan refresh halaman; jangan impor ulang.",
        );
      }
    } catch (e) {
      const issues =
        e && typeof e === "object" && "issues" in e ? (e.issues as ImportIssue[]) : null;
      if (issues?.length) setPreview({ ...preview, errors: issues });
      setError(e instanceof Error ? e.message : "Impor gagal. Tidak ada baris disimpan.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="btn secondary"
        onClick={() => {
          setOpen(true);
          setTable(null);
          setPreview(null);
          setFileName("");
          setMapping({});
          setError("");
          setSuccess(null);
        }}
      >
        <FileSpreadsheet size={17} /> Impor
      </button>
      <Modal
        open={open}
        title={"Impor " + (kind === "anggota" ? "anggota" : "inventaris")}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
      >
        <div className="import-wizard">
          <ol className="import-steps" aria-label="Langkah impor">
            <li className={!table ? "is-current" : "is-complete"}>Pilih berkas</li>
            <li className={table && !preview ? "is-current" : ""}>Cocokkan kolom</li>
            <li className={preview ? "is-current" : ""}>Periksa dan impor</li>
          </ol>
          {success !== null ? (
            <div className="import-success" role="status">
              <CheckCircle2 size={36} />
              <h3>{success} baris berhasil diimpor</h3>
              <p>Data sudah disimpan di database. Jangan mengunggah batch yang sama kembali.</p>
              {error && <Notice tone="error">{error}</Notice>}
              <button className="btn primary" onClick={() => setOpen(false)}>
                Selesai
              </button>
            </div>
          ) : (
            <>
              <div className="import-file-panel">
                <div>
                  <h3>Berkas sumber</h3>
                  <p>
                    CSV atau XLSX, maksimal 2.000 baris. NIM, NIA dan kode alat tetap berupa teks.
                  </p>
                </div>
                <button
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => void downloadImportTemplate(kind)}
                >
                  Unduh template CSV
                </button>
                <label htmlFor={fileId} className="import-file-picker">
                  <UploadCloud size={27} />
                  <span>
                    <strong>{fileName || "Pilih berkas dari perangkat"}</strong>
                    <small>
                      {table
                        ? table.rows.length + " baris · " + table.headers.length + " kolom"
                        : "CSV / XLSX tanpa formula atau makro"}
                    </small>
                  </span>
                  <input
                    id={fileId}
                    type="file"
                    accept=".csv,.xlsx"
                    disabled={busy}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setBusy(true);
                      setError("");
                      setPreview(null);
                      setTable(null);
                      try {
                        const data = await readImportFile(file);
                        setFileName(file.name);
                        setTable(data);
                        setMapping(
                          Object.fromEntries(
                            importFields[kind].map((key) => [
                              key,
                              data.headers.find(
                                (h) => normalizeImportHeader(h) === normalizeImportHeader(key),
                              ) || "",
                            ]),
                          ),
                        );
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Berkas tidak dapat dibaca.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                </label>
              </div>
              {table ? (
                <section className="import-mapping" aria-label="Pemetaan kolom">
                  <h3>Cocokkan kolom sumber</h3>
                  <p>
                    Kolom bertanda * wajib dipetakan. Data yang belum tersedia tidak diisi nilai
                    contoh.
                  </p>
                  <div className="import-mapping-grid">
                    {importFields[kind].map((key) => (
                      <label key={key} className="import-mapping-field">
                        <span>
                          {importLabels[key]}
                          {requiredImportFields[kind].includes(key) && <b aria-label="wajib"> *</b>}
                        </span>
                        <select
                          disabled={busy}
                          value={mapping[key] || ""}
                          onChange={(e) => {
                            setMapping({ ...mapping, [key]: e.target.value });
                            setPreview(null);
                            setError("");
                          }}
                        >
                          <option value="">Tidak dipetakan</option>
                          {table.headers.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                        {key === "nim" || key === "kontak" ? (
                          <small>Boleh kosong jika data lama belum tersedia.</small>
                        ) : key === "foto" || key === "photo" ? (
                          <small>Gunakan media terdaftar, atau biarkan kosong.</small>
                        ) : null}
                      </label>
                    ))}
                  </div>
                  <button
                    className="btn secondary"
                    disabled={busy}
                    onClick={() => {
                      setError("");
                      setPreview(prepareBackendImport(kind, table, mapping));
                    }}
                  >
                    Validasi seluruh berkas
                  </button>
                </section>
              ) : (
                <Empty
                  title="Pilih berkas untuk memulai"
                  description="Data baru disimpan setelah seluruh batch lolos pemeriksaan dan kamu menekan tombol impor."
                />
              )}
              {error && <Notice tone="error">{error}</Notice>}
              {preview && (
                <BackendImportPreview
                  kind={kind}
                  result={preview}
                  busy={busy}
                  onSubmit={() => void submit()}
                />
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
