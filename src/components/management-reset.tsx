"use client";
import { useState } from "react";
import type { Role } from "@/lib/types";
import { useDemo, updateStore } from "@/lib/store";
import {
  applyRollover,
  previewRollover,
  requestSuperUserReset,
  type PasswordChoice,
} from "@/lib/management";
import { Field, Modal, Notice, Badge } from "./ui";
import { useToast } from "./providers";
export function ManagementReset({ role }: { role: Role }) {
  const state = useDemo(),
    toast = useToast();
  const [year, setYear] = useState(""),
    [choices, setChoices] = useState<Record<string, PasswordChoice>>({}),
    [review, setReview] = useState(false),
    [superReset, setSuperReset] = useState(false),
    [error, setError] = useState("");
  if (role !== "Super User")
    return <Notice tone="error">Menu ini hanya untuk Super User.</Notice>;
  const users = state.records.pengguna.filter(
    (u) => !u.archived && u.fields.role !== "Super User",
  );
  let summary: ReturnType<typeof previewRollover> | null = null;
  try {
    summary = previewRollover(state, year, choices);
  } catch {}
  return (
    <>
      <div className="admin-panel management-intro">
        <div>
          <Badge>Kepengurusan {state.settings.managementPeriod}</Badge>
          <h2>Serah terima, tanpa kehilangan riwayat.</h2>
          <p>
            Pinjaman selesai atau ditolak masuk arsip. Pengajuan dan alat yang
            belum kembali tetap dikelola pada periode baru.
          </p>
        </div>
        <Field
          label="Tahun kepengurusan baru"
          type="number"
          min={Number(state.settings.managementPeriod) + 1}
          max={9999}
          placeholder={String(Number(state.settings.managementPeriod) + 1)}
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
            setReview(false);
            setError("");
          }}
        />
      </div>
      <Notice>
        Periode kepengurusan terpisah dari Open Recruitment. Anggota,
        inventaris, kampanye dan periode OR tidak direset. Seluruh perubahan
        berikut hanya simulasi frontend.
      </Notice>
      <h2 className="admin-section-title">Akses admin setelah pergantian</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Akun</th>
              <th>Peran</th>
              <th>Password</th>
              <th>Status permintaan</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.fields.nama}
                  <small className="table-subtext">{u.fields.email}</small>
                </td>
                <td>{u.fields.role}</td>
                <td>
                  <select
                    aria-label={"Password " + u.fields.email}
                    value={choices[u.id] || "keep"}
                    onChange={(e) => {
                      setChoices({
                        ...choices,
                        [u.id]: e.target.value as PasswordChoice,
                      });
                      setReview(false);
                    }}
                  >
                    <option value="keep">Pertahankan password</option>
                    <option value="request-new">
                      Ganti baru (permintaan preview)
                    </option>
                  </select>
                </td>
                <td>
                  {u.fields.resetRequired === "Ya" ? (
                    <Badge>Permintaan ganti tercatat</Badge>
                  ) : (
                    "Tidak ada permintaan"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="admin-panel reset-impact">
        <h3>Ringkasan perubahan</h3>
        {summary ? (
          <p>
            <strong>{summary.archiveIds.length}</strong> pinjaman diarsipkan ·{" "}
            <strong>{summary.carryIds.length}</strong> pinjaman diteruskan ·{" "}
            <strong>{summary.resetUserIds.length}</strong> permintaan ganti
            password
          </p>
        ) : (
          <p>Masukkan tahun baru untuk melihat dampaknya.</p>
        )}
        <p>
          Kode WPL, kondisi, jaminan, denda, dan riwayat tidak dihapus. Password
          nyata belum berubah; permintaan akan menjadi alur backend pada tahap
          berikutnya.
        </p>
        {error && <Notice tone="error">{error}</Notice>}
        <button
          className="btn primary"
          disabled={!summary}
          onClick={() => setReview(true)}
        >
          Tinjau reset kepengurusan
        </button>
      </div>
      <div className="admin-panel super-reset-panel">
        <h3>Reset password Super User</h3>
        <p>
          Tindakan terpisah dari reset massal. Pada preview, hanya status
          permintaan yang dicatat; akun tidak terkunci dan password login tidak
          diubah.
        </p>
        {state.settings.superUserResetRequestedAt && (
          <Badge>Permintaan preview sudah tercatat</Badge>
        )}
        <button className="btn secondary" onClick={() => setSuperReset(true)}>
          Minta reset Super User
        </button>
      </div>
      <Modal
        open={review}
        title={"Konfirmasi kepengurusan " + year}
        onClose={() => setReview(false)}
      >
        {summary && (
          <>
            <p>
              Arsipkan {summary.archiveIds.length} peminjaman selesai/ditolak
              dan teruskan {summary.carryIds.length} yang belum selesai.
            </p>
            <p>
              Catat permintaan ganti untuk {summary.resetUserIds.length} akun.
              Akun lain mempertahankan aksesnya; Super User tidak termasuk
              operasi massal.
            </p>
            <Notice>
              Tidak ada penghapusan permanen. Ini hanya data preview pada
              browser.
            </Notice>
            <div className="button-row">
              <button
                className="btn primary"
                onClick={() => {
                  try {
                    updateStore(
                      (d) => applyRollover(d, year, choices, role),
                      "Reset kepengurusan",
                      year,
                      role,
                      `Arsip ${summary.archiveIds.length}; diteruskan ${summary.carryIds.length}; permintaan reset ${summary.resetUserIds.join(",")}`,
                    );
                    setReview(false);
                    setYear("");
                    setChoices({});
                    toast("Kepengurusan diperbarui. Riwayat tetap tersimpan.");
                  } catch (e) {
                    setReview(false);
                    setError(e instanceof Error ? e.message : "Reset gagal.");
                  }
                }}
              >
                Konfirmasi reset preview
              </button>
              <button
                className="btn secondary"
                onClick={() => setReview(false)}
              >
                Batal
              </button>
            </div>
          </>
        )}
      </Modal>
      <Modal
        open={superReset}
        title="Permintaan reset Super User"
        onClose={() => setSuperReset(false)}
      >
        <Notice>
          Ini tidak mengganti kredensial nyata. Reset aman, verifikasi pemilik
          dan pencabutan sesi diterapkan di backend.
        </Notice>
        <div className="button-row">
          <button
            className="btn primary"
            onClick={() => {
              try {
                updateStore(
                  (d) => requestSuperUserReset(d, role),
                  "Permintaan reset Super User",
                  "Super User",
                  role,
                );
                setSuperReset(false);
                toast("Permintaan reset preview tercatat.");
              } catch (e) {
                toast(e instanceof Error ? e.message : "Gagal menyimpan.");
              }
            }}
          >
            Catat permintaan preview
          </button>
          <button
            className="btn secondary"
            onClick={() => setSuperReset(false)}
          >
            Batal
          </button>
        </div>
      </Modal>
    </>
  );
}
