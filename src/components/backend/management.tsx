"use client";
import Link from "next/link";
import { useState } from "react";
import type { listUsers } from "@/server/auth/users";
import { Field, Modal, Notice } from "../ui";
import { backendApi } from "./api";

type Result = {
  year: number;
  archived: number;
  carried: number;
  credentials: Array<{
    userId: string;
    email: string;
    temporaryPassword: string;
  }>;
};
export function BackendManagement({
  initialYear,
  users,
  csrfToken,
}: {
  initialYear: number;
  users: Awaited<ReturnType<typeof listUsers>>;
  csrfToken: string;
}) {
  const admins = users.filter(
    (u) => u.role !== "SUPER_USER" && u.active && !u.archivedAt,
  );
  const [year, setYear] = useState(initialYear),
    [nextYear, setNextYear] = useState(initialYear + 1);
  const [choices, setChoices] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState(false),
    [typedYear, setTypedYear] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  async function execute() {
    if (busy || typedYear !== String(nextYear)) return;
    setBusy(true);
    setError("");
    try {
      const data = await backendApi<Result>(
        "/api/admin/management",
        csrfToken,
        {
          expectedYear: year,
          year: nextYear,
          passwordChoices: admins.map((u) => ({
            userId: u.id,
            reset: !!choices[u.id],
          })),
        },
      );
      setYear(data.year);
      setNextYear(data.year + 1);
      setChoices({});
      setConfirm(false);
      setTypedYear("");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Periode belum dapat diganti.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Notice>
        Periode kepengurusan berbeda dari periode Open Recruitment. Pergantian
        ini tidak menutup atau menghapus pendaftaran anggota.
      </Notice>
      <div className="card">
        <h2>Periode {year}</h2>
        <p>
          Peminjaman selesai atau ditolak diarsipkan hanya jika tidak ada denda
          dan jaminan yang belum diselesaikan. Peminjaman aktif tetap dibawa ke
          periode baru; stok tidak dibebaskan.
        </p>
        <Field
          label="Tahun kepengurusan baru"
          type="number"
          min={year + 1}
          max={2200}
          value={nextYear}
          onChange={(e) => setNextYear(Number(e.target.value))}
        />
      </div>
      <h2>Password admin</h2>
      <p>
        Pilihan awal mempertahankan semua password. Akun Super User tidak
        termasuk reset massal ini.
      </p>
      {admins.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama / email</th>
                <th>Password saat pergantian</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <br />
                    {user.email}
                  </td>
                  <td>
                    <label>
                      Pilihan untuk {user.name}
                      <select
                        value={choices[user.id] ? "reset" : "keep"}
                        onChange={(e) =>
                          setChoices({
                            ...choices,
                            [user.id]: e.target.value === "reset",
                          })
                        }
                      >
                        <option value="keep">Pertahankan password</option>
                        <option value="reset">Ganti password baru</option>
                      </select>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Notice>Belum ada admin aktif selain Super User.</Notice>
      )}
      {error && !confirm && <Notice tone="error">{error}</Notice>}
      <div className="button-row">
        <button
          className="btn primary"
          disabled={
            !Number.isInteger(nextYear) ||
            nextYear <= year ||
            nextYear > 2200 ||
            busy ||
            !!result
          }
          onClick={() => {
            setError("");
            setTypedYear("");
            setConfirm(true);
          }}
        >
          Tinjau pergantian periode
        </button>
        <Link className="btn secondary" href="/wapala/password">
          Ganti password Super User
        </Link>
      </div>
      <Modal
        open={confirm}
        title="Konfirmasi pergantian kepengurusan"
        onClose={() => {
          if (!busy) setConfirm(false);
        }}
      >
        <p>
          Periode {year} menjadi {nextYear}.
        </p>
        <p>
          {admins.filter((u) => choices[u.id]).length} akun mendapat password
          baru dan seluruh sesi akun tersebut dicabut. Akun lainnya
          mempertahankan password.
        </p>
        <Notice>
          Pengarsipan dan pergantian password dilakukan dalam satu transaksi.
          Periksa pilihan sebelum melanjutkan.
        </Notice>
        <Field
          label={"Ketik tahun " + nextYear + " untuk mengonfirmasi"}
          value={typedYear}
          onChange={(e) => setTypedYear(e.target.value)}
          autoComplete="off"
        />
        {error && <Notice tone="error">{error}</Notice>}
        <div className="button-row">
          <button
            className="btn primary"
            disabled={busy || typedYear !== String(nextYear)}
            onClick={() => void execute()}
          >
            {busy ? "Memproses…" : "Ganti periode kepengurusan"}
          </button>
          <button
            className="btn secondary"
            disabled={busy}
            onClick={() => setConfirm(false)}
          >
            Batal
          </button>
        </div>
      </Modal>
      <Modal
        open={!!result}
        title="Periode berhasil diganti"
        onClose={() => setResult(null)}
      >
        {result && (
          <>
            <p>
              Periode {result.year}. {result.archived} peminjaman diarsipkan;{" "}
              {result.carried} kewajiban dibawa ke periode baru.
            </p>
            {result.credentials.length > 0 && (
              <>
                <Notice>
                  Password sementara hanya ditampilkan sekarang. Salin dan
                  sampaikan melalui jalur privat sebelum menutup panel ini.
                </Notice>
                {result.credentials.map((c) => (
                  <div key={c.userId}>
                    <p>{c.email}</p>
                    <Field
                      label="Password sementara"
                      value={c.temporaryPassword}
                      readOnly
                      autoComplete="off"
                    />
                  </div>
                ))}
              </>
            )}
            <button className="btn primary" onClick={() => setResult(null)}>
              Selesai
            </button>
          </>
        )}
      </Modal>
    </>
  );
}
