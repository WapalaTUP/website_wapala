"use client";
import { useState } from "react";
import type { listLoans } from "@/server/domains/loans";
import { Badge, Empty, Field, Modal, Notice, Textarea } from "../ui";
import { backendApi } from "./api";
import { initialReturnCondition } from "@/lib/operational-schema";
type Loan = Awaited<ReturnType<typeof listLoans>>[number];
type Status = Loan["status"];
const labels: Record<Status, string> = {
  requested: "Diajukan",
  approved: "Disetujui",
  borrowed: "Dipinjam",
  awaiting_return: "Menunggu verifikasi pengembalian",
  late: "Terlambat",
  returned: "Dikembalikan",
  rejected: "Ditolak",
};
const actions: Record<Status, Status[]> = {
  requested: ["approved", "rejected"],
  approved: ["borrowed", "rejected"],
  borrowed: ["awaiting_return", "late"],
  awaiting_return: ["returned", "late"],
  late: ["awaiting_return", "returned"],
  returned: [],
  rejected: [],
};
type Draft = {
  loan: Loan;
  status: Status;
  note: string;
  quantities: Record<string, number>;
  reasons: Record<string, string>;
  conditions: Record<string, string>;
  penalty: number;
  penaltyStatus: "pending" | "paid";
};
export function BackendLoans({
  initialLoans,
  csrfToken,
}: {
  initialLoans: Loan[];
  csrfToken: string;
}) {
  const [loans, setLoans] = useState(initialLoans),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [detail, setDetail] = useState<Loan | null>(null),
    [draft, setDraft] = useState<Draft | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const rows = loans.filter(
    (l) =>
      !l.archived &&
      (status === "all" || l.status === status) &&
      (l.code + " " + l.pic + " " + l.institution)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  function open(loan: Loan, next: Status) {
    setDetail(null);
    setError("");
    setDraft({
      loan,
      status: next,
      note: "",
      quantities: Object.fromEntries(
        loan.items.map((i) => [i.equipmentId, i.requested]),
      ),
      reasons: {},
      conditions: Object.fromEntries(
        loan.items
          .filter((i) => i.approved > 0)
          .map((i) => [i.equipmentId, initialReturnCondition(i.outCondition)]),
      ),
      penalty: loan.penalty,
      penaltyStatus: loan.penaltyStatus === "paid" ? "paid" : "pending",
    });
  }
  async function save() {
    if (!draft || busy) return;
    setBusy(true);
    setError("");
    try {
      await backendApi("/api/admin/loans/" + draft.loan.id, csrfToken, {
        status: draft.status,
        note: draft.note,
        ...(draft.status === "approved"
          ? {
              items: draft.loan.items.map((i) => ({
                equipmentId: i.equipmentId,
                approved: draft.quantities[i.equipmentId] || 0,
                reason: draft.reasons[i.equipmentId] || "",
              })),
            }
          : {}),
        ...(draft.status === "returned"
          ? {
              returns: draft.loan.items
                .filter((i) => i.approved > 0)
                .map((i) => ({
                  equipmentId: i.equipmentId,
                  condition: draft.conditions[i.equipmentId],
                })),
              penalty: draft.penalty,
              penaltyStatus: draft.penalty ? draft.penaltyStatus : "none",
            }
          : {}),
      });
      const data = await backendApi<{ loans: Loan[] }>(
        "/api/admin/loans",
        csrfToken,
      );
      setLoans(data.loans);
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Perubahan belum tersimpan.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="admin-toolbar">
        <Field
          label="Cari peminjaman"
          value={search}
          placeholder="Kode, PIC, atau lembaga"
          onChange={(e) => setSearch(e.target.value)}
        />
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Semua status</option>
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Notice>
        Stok disahkan oleh server saat persetujuan. Alat yang belum diverifikasi
        kembali tetap terikat peminjaman.
      </Notice>
      {error && !draft && <Notice tone="error">{error}</Notice>}
      {rows.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kode / lembaga</th>
                <th>PIC / jadwal</th>
                <th>Status</th>
                <th>Periode</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td>
                    <strong>{l.code}</strong>
                    <br />
                    {l.institution}
                  </td>
                  <td>
                    {l.pic}
                    <br />
                    {l.start} — {l.end}
                  </td>
                  <td>
                    <Badge>{labels[l.status]}</Badge>
                    {l.penaltyStatus === "pending" && <p>Denda belum lunas</p>}
                  </td>
                  <td>{l.managementYear}</td>
                  <td>
                    <button
                      className="btn secondary"
                      onClick={() => setDetail(l)}
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
          title="Belum ada peminjaman pada filter ini"
          description="Pengajuan yang diterima server akan muncul di sini."
        />
      )}
      <Modal
        open={!!detail}
        title={detail ? "Peminjaman " + detail.code : "Peminjaman"}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <>
            <p>
              {detail.institution} · {detail.pic}
            </p>
            <p>
              {detail.phone} · {detail.email}
            </p>
            <p>
              {detail.event}
              <br />
              {detail.purpose}
            </p>
            <p>
              Jaminan: {detail.collateral} ({detail.collateralStatus})
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Alat</th>
                    <th>Diminta</th>
                    <th>Disetujui</th>
                    <th>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((i) => (
                    <tr key={i.equipmentId}>
                      <td>{i.name}</td>
                      <td>{i.requested}</td>
                      <td>{i.approved}</td>
                      <td>
                        {i.reason || "—"}
                        <br />
                        {i.returnCondition}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>Riwayat</h3>
            {detail.history.map((h, index) => (
              <p key={index}>
                {new Date(h.at).toLocaleString("id-ID", {
                  timeZone: "Asia/Jakarta",
                })}{" "}
                · {labels[h.status]}
                <br />
                {h.note}
              </p>
            ))}
            <div className="button-row">
              {actions[detail.status].map((next) => (
                <button
                  key={next}
                  className="btn secondary"
                  onClick={() => open(detail, next)}
                >
                  {next === "approved"
                    ? "Tinjau persetujuan"
                    : next === "returned"
                      ? "Verifikasi pengembalian"
                      : labels[next]}
                </button>
              ))}
            </div>
          </>
        )}
      </Modal>
      <Modal
        open={!!draft}
        title={
          draft
            ? labels[draft.status] + " · " + draft.loan.code
            : "Perubahan status"
        }
        onClose={() => {
          if (!busy) setDraft(null);
        }}
      >
        {draft && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            {draft.status === "approved" && (
              <>
                <Notice>
                  Jumlah yang dikurangi wajib disertai alasan. Jadwal yang
                  tumpang tindih diperiksa otomatis saat disimpan.
                </Notice>
                {draft.loan.items.map((i) => (
                  <div className="form-grid" key={i.equipmentId}>
                    <Field
                      label={i.name + " (diminta " + i.requested + ")"}
                      type="number"
                      min={0}
                      max={i.requested}
                      required
                      value={draft.quantities[i.equipmentId]}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          quantities: {
                            ...draft.quantities,
                            [i.equipmentId]: Number(e.target.value),
                          },
                        })
                      }
                    />
                    <Field
                      label="Alasan penyesuaian"
                      required={draft.quantities[i.equipmentId] !== i.requested}
                      value={draft.reasons[i.equipmentId] || ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          reasons: {
                            ...draft.reasons,
                            [i.equipmentId]: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                ))}
              </>
            )}
            {draft.status === "returned" && (
              <>
                <Notice>
                  Verifikasi kondisi alat dan pengembalian jaminan sebelum
                  menyimpan. Alat rusak/hilang mengurangi jumlah layak
                  inventaris.
                </Notice>
                {draft.loan.items
                  .filter((i) => i.approved > 0)
                  .map((i) => (
                    <label key={i.equipmentId}>
                      Kondisi {i.name}
                      <select
                        required
                        value={draft.conditions[i.equipmentId]}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            conditions: {
                              ...draft.conditions,
                              [i.equipmentId]: e.target.value,
                            },
                          })
                        }
                      >
                        <option value="">
                          Pilih kondisi setelah diperiksa
                        </option>
                        {[
                          "Baik",
                          "Kotor",
                          "Rusak Ringan",
                          "Rusak Berat",
                          "Hilang",
                        ].map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                <div className="form-grid">
                  <Field
                    label="Denda (Rp)"
                    type="number"
                    min={0}
                    max={1000000000}
                    value={draft.penalty}
                    onChange={(e) =>
                      setDraft({ ...draft, penalty: Number(e.target.value) })
                    }
                  />
                  <label>
                    Pembayaran denda
                    <select
                      value={draft.penaltyStatus}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          penaltyStatus: e.target.value as "pending" | "paid",
                        })
                      }
                    >
                      <option value="pending">Belum lunas</option>
                      <option value="paid">Lunas</option>
                    </select>
                  </label>
                </div>
              </>
            )}
            <Textarea
              label="Catatan admin"
              required={
                draft.status === "rejected" || draft.status === "returned"
              }
              value={draft.note}
              onChange={(value) => setDraft({ ...draft, note: value })}
            />
            {error && <Notice tone="error">{error}</Notice>}
            <div className="button-row">
              <button className="btn primary" disabled={busy}>
                {busy ? "Memproses…" : "Simpan perubahan"}
              </button>
              <button
                className="btn secondary"
                type="button"
                disabled={busy}
                onClick={() => setDraft(null)}
              >
                Batal
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
