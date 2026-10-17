"use client";
import { useState } from "react";
import { Field, Modal, Notice } from "../ui";
import { backendApi } from "./api";
type Preview = {
  count: number;
  blocked: number;
  blockReasons?: string[];
  snapshot: string;
  confirmation: string;
};
export function DataReset({
  target,
  id,
  selectionLabel,
  csrfToken,
  onReset,
}: {
  target: "members" | "inventory" | "users";
  id?: string;
  selectionLabel?: string;
  csrfToken: string;
  onReset: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"archive" | "delete">(id ? "delete" : "archive");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const label = target === "members" ? "anggota" : target === "users" ? "pengguna" : "inventaris";
  function close() {
    if (busy) return;
    setOpen(false);
    setPreview(null);
    setPassword("");
    setConfirmation("");
    setError("");
  }
  async function inspect() {
    setBusy(true);
    setError("");
    setPreview(null);
    setPassword("");
    setConfirmation("");
    try {
      setPreview(
        await backendApi<Preview>("/api/admin/data-reset", csrfToken, {
          target,
          mode,
          ...(id ? { id } : {}),
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pemeriksaan gagal.");
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!preview || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await backendApi<{ affected: number }>(
        "/api/admin/data-reset",
        csrfToken,
        { target, mode, ...(id ? { id } : {}), snapshot: preview.snapshot, confirmation, password },
        "DELETE",
      );
      // Once committed, never offer the same destructive request again on refresh failure.
      setOpen(false);
      setPreview(null);
      setConfirmation("");
      setPassword("");
      setSuccess(
        `${result.affected} data ${label} ${mode === "archive" ? "diarsipkan" : "dihapus permanen"}.`,
      );
      try {
        await onReset();
      } catch {
        setSuccess(
          `${id ? "Penghapusan" : "Reset"} selesai. Muat ulang halaman untuk memperbarui daftar.`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset gagal.");
      setPassword("");
      setPreview(null);
      setConfirmation("");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className={id ? "text-link danger-text" : "btn secondary"}
        type="button"
        onClick={() => {
          setSuccess("");
          setMode(id ? "delete" : "archive");
          setOpen(true);
        }}
      >
        {id ? "Hapus" : "Reset " + label}
      </button>
      {success && <Notice>{success}</Notice>}
      <Modal open={open} title={`${id ? "Hapus" : "Reset"} ${label}`} onClose={close}>
        {id && (
          <p>
            <strong>{selectionLabel || id}</strong>
          </p>
        )}
        <Notice tone="error">
          {id
            ? target === "users"
              ? "Hapus permanen akun ini beserta sesi login dan token reset password. Profil anggota, konten, dan catatan audit tetap tersimpan."
              : "Hapus permanen hanya data yang dipilih. Foto tersimpan dan riwayat peminjaman tetap dipertahankan."
            : "Tindakan massal khusus Super User. Ekspor/backup data sebelum melanjutkan. Akun login, foto tersimpan, dan riwayat peminjaman tidak ikut dihapus."}
        </Notice>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (preview) void submit();
            else void inspect();
          }}
        >
          {!id && (
            <label className="field">
              Pilihan reset
              <select
                value={mode}
                disabled={busy}
                onChange={(e) => {
                  setMode(e.target.value as "archive" | "delete");
                  setPreview(null);
                  setPassword("");
                  setConfirmation("");
                  setError("");
                }}
              >
                <option value="archive">Arsipkan semua data aktif (bisa dipulihkan)</option>
                <option value="delete">Hapus permanen semua data, termasuk arsip</option>
              </select>
            </label>
          )}
          <p>
            {mode === "archive"
              ? "Data aktif disembunyikan dan tetap ada di menu Arsip. Identitas/kode tetap digunakan oleh data arsip."
              : target === "users"
                ? "Akun sendiri dan Super User aktif terakhir tidak dapat dihapus."
                : target === "inventory"
                  ? "Tidak bisa dibatalkan dari aplikasi. Alat dari peminjaman yang sudah dikembalikan/ditolak boleh dihapus; detail alat tetap disimpan di riwayat dan invoice. Peminjaman yang belum selesai memblokir seluruh penghapusan."
                  : "Tidak bisa dibatalkan dari aplikasi. Seluruh proses ditolak jika ada anggota yang masih terkait akun atau riwayat koreksi."}
          </p>
          {preview && (
            <>
              <Notice>
                {preview.count} data terdampak; {preview.blocked} data menghalangi reset.{" "}
                {target === "inventory" &&
                  mode === "archive" &&
                  "Peminjaman yang belum selesai/ditolak harus diselesaikan dahulu."}
              </Notice>
              {preview.blockReasons?.map((reason) => (
                <Notice key={reason} tone="error">
                  {reason}
                </Notice>
              ))}
              <Field
                label={`Ketik: ${preview.confirmation}`}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
                disabled={busy}
              />
              <Field
                label="Password Super User saat ini"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </>
          )}
          {error && <Notice tone="error">{error}</Notice>}
          <div className="button-row">
            <button
              className="btn primary"
              disabled={
                busy ||
                (!!preview &&
                  (preview.blocked > 0 ||
                    preview.count === 0 ||
                    confirmation !== preview.confirmation ||
                    !password))
              }
            >
              {busy
                ? "Memproses…"
                : preview
                  ? mode === "archive"
                    ? "Arsipkan semua"
                    : "Hapus permanen"
                  : "Periksa data terdampak"}
            </button>
            <button className="btn secondary" type="button" disabled={busy} onClick={close}>
              Batal
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
