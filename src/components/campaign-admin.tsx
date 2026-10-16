"use client";
import Image from "next/image";
import { useState } from "react";
import type { Campaign, Role } from "@/lib/types";
import { useDemo, updateStore } from "@/lib/store";
import { blankCampaign, campaignTotal, getBankAccounts, validateCampaign } from "@/lib/campaigns";
import { canEdit } from "@/lib/domain";
import { money, date } from "@/lib/content";
import { Badge, Empty, Field, Modal, Notice, Textarea, Upload } from "./ui";
import { useToast } from "./providers";
const labels = {
  draft: "Draft",
  active: "Aktif",
  closed: "Ditutup",
  archived: "Arsip",
};
export function CampaignAdmin({ role }: { role: Role }) {
  const state = useDemo(),
    toast = useToast(),
    edit = canEdit(role, "donasi");
  const [draft, setDraft] = useState<Campaign | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all"),
    [statusFilter, setStatusFilter] = useState("all"),
    [selected, setSelected] = useState(""),
    [reason, setReason] = useState("");
  const donation = state.donations.find((d) => d.id === selected);
  const run = (recipe: Parameters<typeof updateStore>[0], action: string, target: string) => {
    try {
      updateStore(recipe, action, target, role);
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal menyimpan.");
      return false;
    }
  };
  async function upload(file: File, key: "cover" | "qrisImage" | "poster") {
    const id = draft?.id;
    setBusy(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Foto tidak dapat dibaca."));
        r.readAsDataURL(file);
      });
      setDraft((d) => (d && d.id === id ? { ...d, [key]: data } : d));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membaca foto.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="admin-toolbar campaign-toolbar">
        <p>Setiap kampanye memiliki tujuan, metode transfer, dan verifikasi sendiri.</p>
        {edit && (
          <button
            className="btn primary"
            onClick={() => {
              setError("");
              setDraft(blankCampaign());
            }}
          >
            Tambah kampanye
          </button>
        )}
      </div>
      <div className="campaign-admin-list">
        {state.campaigns.map((c) => (
          <article className="admin-panel campaign-admin-card" key={c.id}>
            {c.cover && (
              <Image
                className="campaign-cover"
                src={c.cover}
                width={500}
                height={320}
                alt={c.title}
                unoptimized
              />
            )}
            <div className="campaign-card-body">
              <div className="campaign-heading">
                <h2>{c.title}</h2>
                <Badge>{labels[c.status]}</Badge>
              </div>
              <p>{c.description}</p>
              <p className="campaign-meta">
                {c.collaborator}
                {c.end ? " · Sampai " + date(c.end) : ""}
              </p>
              <div className="campaign-total">
                <strong>{money(campaignTotal(state.donations, c.id))}</strong>
                <span>terverifikasi dari target {money(c.target)}</span>
              </div>
              <div className="progress-track">
                <div
                  style={{
                    width:
                      Math.min(100, (campaignTotal(state.donations, c.id) / c.target) * 100) + "%",
                  }}
                />
              </div>
              <div className="button-row">
                {edit && (
                  <>
                    <button
                      className="btn secondary"
                      onClick={() => {
                        setError("");
                        setDraft({ ...c });
                      }}
                    >
                      Edit kampanye
                    </button>
                    <button
                      className="btn secondary"
                      onClick={() =>
                        run(
                          (d) => {
                            const item = d.campaigns.find((v) => v.id === c.id)!;
                            item.status = c.status === "active" ? "closed" : "active";
                          },
                          "Mengubah status kampanye",
                          c.id,
                        )
                      }
                    >
                      {c.status === "active" ? "Tutup kampanye" : "Aktifkan kampanye"}
                    </button>
                  </>
                )}
                <button className="text-link" onClick={() => setFilter(c.id)}>
                  Lihat konfirmasi
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="admin-toolbar">
        <div className="field">
          <label htmlFor="campaign-filter">Kampanye konfirmasi</label>
          <select id="campaign-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Semua kampanye</option>
            {state.campaigns.map((c) => (
              <option value={c.id} key={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="donation-status-filter">Status konfirmasi</label>
          <select
            id="donation-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {["all", "Menunggu", "Terverifikasi", "Ditolak"].map((s) => (
              <option value={s} key={s}>
                {s === "all" ? "Semua status" : s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nama / kampanye</th>
              <th>Nominal</th>
              <th>Metode</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {state.donations
              .filter(
                (d) =>
                  !d.archived &&
                  (filter === "all" || d.campaignId === filter) &&
                  (statusFilter === "all" || d.status === statusFilter),
              )
              .map((d) => (
                <tr key={d.id}>
                  <td>
                    {d.name}
                    <small className="table-subtext">
                      {state.campaigns.find((c) => c.id === d.campaignId)?.title || "Kampanye lama"}
                    </small>
                  </td>
                  <td>{money(d.amount)}</td>
                  <td>{d.method}</td>
                  <td>
                    <Badge>{d.status}</Badge>
                  </td>
                  <td>
                    <button
                      className="btn secondary"
                      onClick={() => {
                        setSelected(d.id);
                        setReason("");
                        setError("");
                      }}
                    >
                      Tinjau
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {state.donations.filter(
        (d) =>
          !d.archived &&
          (filter === "all" || d.campaignId === filter) &&
          (statusFilter === "all" || d.status === statusFilter),
      ).length === 0 && (
        <Empty
          title="Belum ada konfirmasi"
          description="Konfirmasi yang dikirim untuk kampanye ini akan tampil di sini."
        />
      )}
      <Modal
        open={!!draft}
        title={
          state.campaigns.some((c) => c.id === draft?.id) ? "Edit kampanye" : "Tambah kampanye"
        }
        onClose={() => {
          if (!busy) setDraft(null);
        }}
      >
        {draft && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const msg = validateCampaign(draft);
              if (msg) {
                setError(msg);
                return;
              }
              if (
                run(
                  (d) => {
                    const i = d.campaigns.findIndex((c) => c.id === draft.id);
                    if (i < 0) d.campaigns.unshift(draft);
                    else d.campaigns[i] = draft;
                  },
                  "Menyimpan kampanye",
                  draft.id,
                )
              )
                setDraft(null);
            }}
          >
            <Field
              label="Judul kampanye"
              value={draft.title}
              required
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <Textarea
              label="Keterangan tujuan / penerima"
              value={draft.description}
              required
              onChange={(v) => setDraft({ ...draft, description: v })}
            />
            <div className="form-grid">
              <Field
                label="Target donasi"
                type="number"
                min={1}
                required
                value={draft.target}
                onChange={(e) => setDraft({ ...draft, target: Number(e.target.value) })}
              />
              <Field
                label="Kolaborator"
                value={draft.collaborator}
                onChange={(e) => setDraft({ ...draft, collaborator: e.target.value })}
              />
              <Field
                label="Tanggal mulai"
                type="date"
                value={draft.start}
                onChange={(e) => setDraft({ ...draft, start: e.target.value })}
              />
              <Field
                label="Tanggal selesai"
                type="date"
                value={draft.end}
                onChange={(e) => setDraft({ ...draft, end: e.target.value })}
              />
            </div>
            <section className="campaign-bank-editor">
              <h3>Bank dan rekening</h3>
              <p>Tambahkan rekening tujuan beserta nama pemilik atau penerimanya.</p>
              {getBankAccounts(draft).map((account, index) => (
                <fieldset className="campaign-bank-row" key={account.id}>
                  <legend>Rekening {index + 1}</legend>
                  <div className="form-grid">
                    {(["bank", "number", "holder"] as const).map((key) => (
                      <Field
                        key={key}
                        required
                        label={
                          key === "bank"
                            ? "Nama bank"
                            : key === "number"
                              ? "Nomor rekening"
                              : "Nama pemilik / penerima rekening"
                        }
                        value={account[key]}
                        onChange={(e) => {
                          const value = e.target.value;
                          setDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  bankAccounts: getBankAccounts(current).map((row) =>
                                    row.id === account.id ? { ...row, [key]: value } : row,
                                  ),
                                }
                              : current,
                          );
                        }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              bankAccounts: getBankAccounts(current).filter(
                                (row) => row.id !== account.id,
                              ),
                            }
                          : current,
                      )
                    }
                  >
                    Hapus rekening
                  </button>
                </fieldset>
              ))}
              <button
                type="button"
                className="btn secondary"
                onClick={() =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          bankAccounts: [
                            ...getBankAccounts(current),
                            {
                              id: crypto.randomUUID(),
                              bank: "",
                              number: "",
                              holder: "",
                            },
                          ],
                        }
                      : current,
                  )
                }
              >
                + Tambah bank dan rekening
              </button>
            </section>
            {(["cover", "poster", "qrisImage"] as const).map((key) => (
              <div key={key}>
                <Upload
                  label={
                    key === "cover"
                      ? "Foto sampul kampanye"
                      : key === "poster"
                        ? "Poster donasi"
                        : "Foto QRIS"
                  }
                  names={draft[key] ? ["Foto tersimpan"] : []}
                  setError={setError}
                  onFiles={(files) => {
                    if (files[0]) void upload(files[0], key);
                  }}
                />
                {draft[key] && (
                  <div className="campaign-image-preview">
                    <Image
                      src={draft[key]!}
                      width={320}
                      height={240}
                      alt={
                        key === "cover"
                          ? "Pratinjau sampul"
                          : key === "poster"
                            ? "Pratinjau poster donasi"
                            : "Pratinjau QRIS"
                      }
                      unoptimized
                    />
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => setDraft({ ...draft, [key]: "" })}
                    >
                      Hapus foto
                    </button>
                  </div>
                )}
              </div>
            ))}
            <Notice>
              Preview lokal. Gunakan aset contoh; belum menerima pembayaran nyata. Foto QRIS tidak
              dibuat otomatis.
            </Notice>
            {error && <Notice tone="error">{error}</Notice>}
            <div className="button-row">
              <button className="btn primary" disabled={busy}>
                {busy ? "Membaca foto…" : "Simpan kampanye"}
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setDraft(null)}
                disabled={busy}
              >
                Batal
              </button>
            </div>
          </form>
        )}
      </Modal>
      <Modal open={!!donation} title="Tinjau konfirmasi" onClose={() => setSelected("")}>
        {donation && (
          <>
            <h3>
              {donation.name} / {money(donation.amount)}
            </h3>
            <p>{state.campaigns.find((c) => c.id === donation.campaignId)?.title}</p>
            <p>
              {donation.method} · {date(donation.at)}
            </p>
            {donation.bankAccountLabel && <p>Rekening tujuan: {donation.bankAccountLabel}</p>}
            <Notice>Bukti contoh: {donation.proof}</Notice>
            <Textarea label="Catatan / alasan penolakan" value={reason} onChange={setReason} />
            {error && <Notice tone="error">{error}</Notice>}
            {edit && (
              <div className="button-row">
                {(["Terverifikasi", "Ditolak"] as const).map((status) => (
                  <button
                    key={status}
                    className="btn secondary"
                    onClick={() => {
                      if (status === "Ditolak" && !reason.trim()) {
                        setError("Tuliskan alasan penolakan.");
                        return;
                      }
                      if (
                        run(
                          (d) => {
                            const row = d.donations.find((v) => v.id === donation.id)!;
                            row.status = status;
                            row.note = reason;
                          },
                          "Meninjau konfirmasi",
                          donation.id,
                        )
                      )
                        setSelected("");
                    }}
                  >
                    {status === "Terverifikasi" ? "Verifikasi" : "Tolak"}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
