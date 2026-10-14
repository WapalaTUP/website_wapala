"use client";
import { useState } from "react";
import type { listApplicants, listPeriods } from "@/server/domains/recruitment";
import { Badge, Empty, Field, Modal, Notice } from "../ui";
import { backendApi } from "./api";
import { date } from "@/lib/content";
import { MediaPreview } from "./media-preview";
import { orFieldLabel } from "@/lib/recruitment-fields";
type Period = Awaited<ReturnType<typeof listPeriods>>[number];
type Applicant = Awaited<ReturnType<typeof listApplicants>>[number];
export function BackendRecruitment({
  initialPeriods,
  initialApplicants,
  initialYear,
  canWrite,
  csrfToken,
}: {
  initialPeriods: Period[];
  initialApplicants: Applicant[];
  initialYear: number;
  canWrite: boolean;
  csrfToken: string;
}) {
  const [periods, setPeriods] = useState(initialPeriods),
    [applicants, setApplicants] = useState(initialApplicants),
    [year, setYear] = useState(initialYear),
    [newYear, setNewYear] = useState(new Date().getFullYear()),
    [selected, setSelected] = useState<Applicant | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const period = periods.find((p) => p.year === year);
  async function load(value: number) {
    const data = await backendApi<{
      periods: Period[];
      applicants: Applicant[];
    }>("/api/admin/recruitment?year=" + value, csrfToken);
    setPeriods(data.periods);
    setApplicants(data.applicants);
    setYear(value);
  }
  async function setPeriod(value: number, active: boolean) {
    setBusy(true);
    setError("");
    try {
      await backendApi("/api/admin/recruitment", csrfToken, {
        year: value,
        active,
      });
      await load(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Periode belum dapat diubah.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p>Periode tahunan dan pendaftar calon anggota.</p>
      <section className="admin-panel">
        <h2>Periode {year}</h2>
        <Badge>{period?.active ? "Aktif" : "Ditutup"}</Badge>
        {canWrite && (
          <div className="button-row recruitment-period-actions">
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => void setPeriod(year, !period?.active)}
            >
              {period?.active ? "Tutup periode" : "Lanjutkan periode"}
            </button>
            <Field
              label="Tahun periode"
              type="number"
              min={2004}
              max={2200}
              value={newYear}
              onChange={(e) => setNewYear(Number(e.target.value))}
            />
            <button
              className="btn secondary"
              disabled={
                busy ||
                !Number.isInteger(newYear) ||
                newYear < 2004 ||
                newYear > 2200
              }
              onClick={() => void setPeriod(newYear, true)}
            >
              Buka periode tahunan
            </button>
          </div>
        )}
      </section>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="admin-toolbar">
        <a
          className="btn secondary"
          href={"/api/admin/recruitment/export?year=" + year + "&format=xlsx"}
        >
          Ekspor Excel
        </a>
        <a
          className="btn secondary"
          href={"/api/admin/recruitment/export?year=" + year + "&format=pdf"}
        >
          Ekspor PDF
        </a>
        <label>
          Filter periode
          <select
            value={year}
            disabled={busy}
            onChange={async (e) => {
              setBusy(true);
              setError("");
              try {
                await load(Number(e.target.value));
              } catch (e) {
                setError(e instanceof Error ? e.message : "Gagal memuat data.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {periods.length ? (
              periods.map((p) => (
                <option value={p.year} key={p.year}>
                  {p.label}
                </option>
              ))
            ) : (
              <option value={year}>Periode {year}</option>
            )}
          </select>
        </label>
      </div>
      {applicants.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nomor / nama</th>
                <th>Prodi</th>
                <th>Tanggal</th>
                <th>Revisi</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {applicants.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.code}
                    <br />
                    {a.fields.nama}
                  </td>
                  <td>{a.fields.prodi}</td>
                  <td>{date(a.createdAt)}</td>
                  <td>{a.revisions}</td>
                  <td>
                    <button
                      className="btn secondary"
                      onClick={() => setSelected(a)}
                    >
                      Lihat
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="Belum ada pendaftar"
          description="Pendaftar periode ini akan tampil setelah formulir dikirim dan tersimpan di server."
        />
      )}
      <Modal
        open={!!selected}
        title={selected?.code || "Detail pendaftar"}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <>
            <MediaPreview
              key={selected.photo}
              src={selected.photo}
              label="Foto pendaftar"
            />
            <dl>
              {Object.entries(selected.fields).map(([key, value]) => (
                <div key={key}>
                  <dt>{orFieldLabel(key)}</dt>
                  <dd>{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </Modal>
    </>
  );
}
