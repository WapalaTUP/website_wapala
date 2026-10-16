"use client";
import Image from "next/image";
import { useState } from "react";
import type { listCampaigns, listDonations } from "@/server/domains/campaigns";
import { money, date } from "@/lib/content";
import { Badge, Empty, Field, Modal, Notice, Textarea, Upload } from "../ui";
import { backendApi, uploadMedia } from "./api";
import { MediaPreview } from "./media-preview";
type Campaign = Awaited<ReturnType<typeof listCampaigns>>[number];
type Donation = Awaited<ReturnType<typeof listDonations>>[number];
type Draft = Omit<Campaign, "id" | "version"> & {
  id?: string;
  version?: number;
};
const labels = {
  draft: "Draft",
  active: "Aktif",
  closed: "Ditutup",
  archived: "Arsip",
  waiting: "Menunggu",
  verified: "Terverifikasi",
  rejected: "Ditolak",
};
const blank = (): Draft => ({
  title: "",
  description: "",
  target: 1000000,
  collaborator: "WAPALA Telkom University",
  start: "",
  end: "",
  status: "draft",
  cover: "",
  poster: "",
  qrisImage: "",
  bankAccounts: [],
});
export function BackendCampaigns({
  initialCampaigns,
  initialDonations,
  csrfToken,
}: {
  initialCampaigns: Campaign[];
  initialDonations: Donation[];
  csrfToken: string;
}) {
  const [campaigns, setCampaigns] = useState(initialCampaigns),
    [donations, setDonations] = useState(initialDonations),
    [draft, setDraft] = useState<Draft | null>(null),
    [review, setReview] = useState<Donation | null>(null),
    [note, setNote] = useState(""),
    [filter, setFilter] = useState("all"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const total = (id: string) =>
    donations
      .filter((d) => d.campaignId === id && d.status === "verified")
      .reduce((sum, d) => sum + d.amount, 0);
  async function refresh() {
    const data = await backendApi<{
      campaigns: Campaign[];
      donations: Donation[];
    }>("/api/admin/campaigns", csrfToken);
    setCampaigns(data.campaigns);
    setDonations(data.donations);
  }
  async function save(value: Draft) {
    setBusy(true);
    setError("");
    try {
      await backendApi("/api/admin/campaigns", csrfToken, value);
      await refresh();
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="admin-toolbar campaign-toolbar">
        <p>Setiap kampanye memiliki penerima, rekening, dan konfirmasi tersendiri.</p>
        <button
          className="btn primary"
          onClick={() => {
            setError("");
            setDraft(blank());
          }}
          disabled={busy}
        >
          Tambah kampanye
        </button>
      </div>
      {error && !draft && !review && <Notice tone="error">{error}</Notice>}
      {!campaigns.length && (
        <Empty
          title="Belum ada kampanye"
          description="Tambahkan tujuan penggalangan dana. Kampanye baru disimpan sebagai draft sebelum dibuka."
        />
      )}
      <div className="campaign-admin-list">
        {campaigns.map((c) => (
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
              <p>
                {c.collaborator}
                {c.end ? " · Sampai " + date(c.end) : ""}
              </p>
              <div className="campaign-total">
                <strong>{money(total(c.id))}</strong>
                <span>terverifikasi dari target {money(c.target)}</span>
              </div>
              <progress
                max={c.target}
                value={Math.min(total(c.id), c.target)}
                aria-label={"Progres " + c.title}
              />
              <div className="button-row">
                <button
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => {
                    setError("");
                    setDraft(structuredClone(c));
                  }}
                >
                  Edit kampanye
                </button>
                <button
                  className="btn secondary"
                  disabled={busy || c.status === "archived"}
                  onClick={() =>
                    void save({
                      ...c,
                      status: c.status === "active" ? "closed" : "active",
                    })
                  }
                >
                  {c.status === "active" ? "Tutup kampanye" : "Aktifkan kampanye"}
                </button>
                <button className="text-link" onClick={() => setFilter(c.id)}>
                  Lihat konfirmasi
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="admin-toolbar">
        <label>
          Kampanye konfirmasi
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Semua kampanye</option>
            {campaigns.map((c) => (
              <option value={c.id} key={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
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
            {donations
              .filter((d) => filter === "all" || d.campaignId === filter)
              .map((d) => (
                <tr key={d.id}>
                  <td>
                    {d.name}
                    <small className="table-subtext">
                      {campaigns.find((c) => c.id === d.campaignId)?.title}
                    </small>
                  </td>
                  <td>{money(d.amount)}</td>
                  <td>{d.method === "bank" ? "Transfer bank" : "QRIS"}</td>
                  <td>
                    <Badge>{labels[d.status]}</Badge>
                  </td>
                  <td>
                    <button
                      className="btn secondary"
                      onClick={() => {
                        setReview(d);
                        setNote("");
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
      <Modal
        open={!!draft}
        title={draft?.id ? "Edit kampanye" : "Tambah kampanye"}
        onClose={() => {
          if (!busy) setDraft(null);
        }}
      >
        {draft && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save(draft);
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
              onChange={(value) => setDraft({ ...draft, description: value })}
            />
            <div className="form-grid">
              <Field
                label="Target donasi"
                type="number"
                min={1}
                value={draft.target}
                required
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
              {draft.bankAccounts.map((bank, index) => (
                <fieldset className="campaign-bank-row" key={bank.id}>
                  <legend>Rekening {index + 1}</legend>
                  <div className="form-grid">
                    {(["bank", "number", "holder"] as const).map((key) => (
                      <Field
                        key={key}
                        label={
                          key === "bank"
                            ? "Nama bank"
                            : key === "number"
                              ? "Nomor rekening"
                              : "Nama pemilik / penerima rekening"
                        }
                        value={bank[key]}
                        required
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            bankAccounts: draft.bankAccounts.map((b) =>
                              b.id === bank.id ? { ...b, [key]: e.target.value } : b,
                            ),
                          })
                        }
                      />
                    ))}
                  </div>
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        bankAccounts: draft.bankAccounts.filter((b) => b.id !== bank.id),
                      })
                    }
                  >
                    Hapus rekening
                  </button>
                </fieldset>
              ))}
              <button
                className="btn secondary"
                type="button"
                onClick={() =>
                  setDraft({
                    ...draft,
                    bankAccounts: [
                      ...draft.bankAccounts,
                      {
                        id: crypto.randomUUID(),
                        bank: "",
                        number: "",
                        holder: "",
                      },
                    ],
                  })
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
                  onFiles={async (files) => {
                    if (!files[0] || busy) return;
                    setBusy(true);
                    setError("");
                    try {
                      const url = await uploadMedia(files[0], "campaign", csrfToken);
                      setDraft((current) => (current ? { ...current, [key]: url } : current));
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Upload gagal.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
                {draft[key] && (
                  <div className="campaign-image-preview">
                    <Image
                      src={draft[key]}
                      width={320}
                      height={240}
                      alt="Pratinjau gambar kampanye"
                      unoptimized
                    />
                    <button
                      className="text-link"
                      type="button"
                      onClick={() => setDraft({ ...draft, [key]: "" })}
                    >
                      Hapus foto
                    </button>
                  </div>
                )}
              </div>
            ))}
            <label>
              Status kampanye
              <select
                value={draft.status}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    status: e.target.value as Campaign["status"],
                  })
                }
              >
                {(["draft", "active", "closed", "archived"] as const).map((s) => (
                  <option value={s} key={s}>
                    {labels[s]}
                  </option>
                ))}
              </select>
            </label>
            <Notice>
              QRIS dan rekening diisi sesuai tujuan kampanye. Konfirmasi transfer diperiksa admin,
              bukan pembayaran otomatis.
            </Notice>
            {error && <Notice tone="error">{error}</Notice>}
            <div className="button-row">
              <button className="btn primary" disabled={busy}>
                {busy ? "Memproses…" : "Simpan kampanye"}
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
      <Modal
        open={!!review}
        title="Tinjau konfirmasi"
        onClose={() => {
          if (!busy) setReview(null);
        }}
      >
        {review && (
          <div className="stack">
            <h3>
              {review.name} / {money(review.amount)}
            </h3>
            <p>{campaigns.find((c) => c.id === review.campaignId)?.title}</p>
            <p>{review.bankAccountLabel || "QRIS"}</p>
            {review.proof ? (
              <MediaPreview key={review.proof} src={review.proof} label="Bukti transfer" />
            ) : (
              <Notice>Bukti belum tersedia.</Notice>
            )}
            <Textarea label="Catatan / alasan penolakan" value={note} onChange={setNote} />
            {error && <Notice tone="error">{error}</Notice>}
            {review.status === "waiting" && (
              <div className="button-row">
                {(["verified", "rejected"] as const).map((status) => (
                  <button
                    className="btn secondary"
                    disabled={busy}
                    key={status}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        await backendApi("/api/admin/donations/" + review.id, csrfToken, {
                          status,
                          note,
                        });
                        await refresh();
                        setReview(null);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Verifikasi gagal.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {status === "verified" ? "Verifikasi" : "Tolak"}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
