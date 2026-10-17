"use client";
import Link from "next/link";
import { Package } from "lucide-react";
import { equipmentDisplayName } from "@/lib/equipment-identity";
import "./loan-catalog.css";
import { useRef, useState, type FormEvent } from "react";
import { useDemo } from "@/lib/store";
import { getBankAccounts, canConfirmDonation, campaignTotal } from "@/lib/campaigns";
import { money, date } from "@/lib/content";
import { orPersonal, orAcademic } from "@/lib/recruitment-fields";
import { PageIntro } from "./page-intro";
import { Empty, Field, Notice, Select, Textarea } from "./ui";
import { PublicUpload, usePublicTransport } from "./public-transport";
function Consent() {
  return (
    <label className="consent">
      <input type="checkbox" name="consent" required />
      <span>
        Saya menyetujui ketentuan layanan dan{" "}
        <Link href="/privasi" target="_blank">
          pemrosesan data pribadi
        </Link>{" "}
        untuk pengajuan ini.
      </span>
    </label>
  );
}
function Receipt({ code, loan = false }: { code: string; loan?: boolean }) {
  return (
    <div className="container success-panel">
      <h1>Pengajuan sudah diterima.</h1>
      <p>Simpan kode ini. Data sudah tersimpan pada server WAPALA.</p>
      <div className="access-code">{code}</div>
      {loan && (
        <Link className="btn primary" href={"/peminjaman/status/" + code}>
          Lihat status pengajuan
        </Link>
      )}
      <Link className="text-link" href="/">
        Kembali ke beranda
      </Link>
    </div>
  );
}
const loanFields = [
  ["institution", "Lembaga"],
  ["pic", "PIC"],
  ["phone", "Nomor telepon"],
  ["email", "Email"],
  ["start", "Tanggal ambil"],
  ["end", "Tanggal kembali"],
  ["event", "Kegiatan"],
  ["purpose", "Keperluan"],
  ["collateral", "Jaminan"],
] as const;
export function LoanForm() {
  const state = useDemo(),
    t = usePublicTransport(),
    [step, setStep] = useState(0),
    [selection, setSelection] = useState<Record<string, number>>({}),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("Semua kategori"),
    [typeFilter, setTypeFilter] = useState("Semua jenis"),
    [fields, setFields] = useState<Record<string, string>>({}),
    [receipt, setReceipt] = useState("");
  const key = useRef<string | null>(null);
  const catalog = state.publicEquipment ?? [];
  const chosen = catalog.filter((e) => e.available && (selection[e.id] ?? 0) > 0),
    filtered = catalog.filter(
      (e) =>
        (category === "Semua kategori" || e.category === category) &&
        (typeFilter === "Semua jenis" || e.typeColor === typeFilter) &&
        [e.name, e.code, e.typeColor, e.brand]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
  const stepsNav = (
    <ol className="steps">
      {["Pilih alat", "Data peminjam", "Periksa pengajuan"].map((label, i) => (
        <li key={label} className={i === step ? "active" : ""}>
          <span>{i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
  const asideInfo = (
    <>
      <h3>Sebelum berangkat</h3>
      <p>Jumlah akhir yang disetujui ditentukan tim inventaris.</p>
      <p>Pengembalian wajib diverifikasi pengelola sebelum barang kembali tersedia.</p>
      <Link href="/peminjaman/status">Lacak pengajuan</Link>
      <p>{chosen.length} jenis alat dipilih</p>
    </>
  );
  const actions = (
    <>
      {t.error && <Notice tone="error">{t.error}</Notice>}
      <div className="form-actions">
        {step > 0 && (
          <button
            type="button"
            className="btn secondary"
            disabled={t.busy}
            onClick={() => {
              key.current = null;
              setStep(step - 1);
            }}
          >
            Kembali
          </button>
        )}
        <button type="submit" form="loan-request-form" className="btn primary" disabled={t.busy}>
          {t.busy
            ? "Mengirim…"
            : step === 0
              ? "Lanjut: data peminjam"
              : step === 1
                ? "Periksa pengajuan"
                : "Kirim pengajuan"}
        </button>
      </div>
    </>
  );
  async function next(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    t.setError("");
    if (step === 0) {
      if (!chosen.length) {
        t.setError("Pilih sedikitnya satu alat dan isi jumlah yang diminta.");
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (fields.end < fields.start) {
        t.setError("Tanggal kembali tidak boleh sebelum tanggal ambil.");
        return;
      }
      setStep(2);
      return;
    }
    key.current ??= crypto.randomUUID();
    try {
      const result = await t.post<{ code: string }>("submit", {
        kind: "loan",
        idempotencyKey: key.current,
        consent: true,
        payload: {
          ...fields,
          items: chosen.map((eq) => ({
            equipmentId: eq.id,
            requested: selection[eq.id],
          })),
        },
      });
      setReceipt(result.code);
    } catch {}
  }
  if (receipt) return <Receipt code={receipt} loan />;
  return (
    <>
      <PageIntro
        title={
          step === 0
            ? "Bekal untuk\nperjalananmu."
            : step === 1
              ? "Siapkan\ndata perjalanan."
              : "Periksa sebelum\nmengirim."
        }
        description="Ajukan peralatan untuk kegiatan MAPALA, lembaga, atau UKM."
      />
      {step === 1 ? (
        <section className="container form-section">
          <form id="loan-request-form" className="form-main" onSubmit={next}>
            {stepsNav}
            <aside className="form-aside aside-inline">{asideInfo}</aside>
            <div className="form-grid">
              {loanFields.map(([key, label]) => (
                <Field
                  key={key}
                  label={label}
                  required
                  type={
                    key === "email"
                      ? "email"
                      : ["start", "end"].includes(key)
                        ? "date"
                        : key === "phone"
                          ? "tel"
                          : "text"
                  }
                  maxLength={key === "purpose" ? 2000 : 300}
                  value={fields[key] ?? ""}
                  onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                />
              ))}
            </div>
            {actions}
          </form>
        </section>
      ) : (
        <section className="container form-section form-layout loan-catalog-layout">
          <form id="loan-request-form" className="form-main" onSubmit={next}>
            {stepsNav}
            {step === 0 ? (
              <>
                <div className="form-grid loan-catalog-filters">
                  <Field
                    label="Cari alat"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <Select
                    label="Kategori"
                    options={["Semua kategori", ...new Set(catalog.map((e) => e.category))]}
                    value={category}
                    onChange={setCategory}
                  />
                  <Select
                    label="Jenis / tipe"
                    value={typeFilter}
                    onChange={setTypeFilter}
                    options={[
                      "Semua jenis",
                      ...new Set(catalog.map((e) => e.typeColor).filter(Boolean)),
                    ]}
                  />
                </div>
                <div className="equipment-list loan-catalog-grid">
                  {filtered.map((eq) => (
                    <div
                      className={
                        "equipment-card loan-catalog-card" +
                        ((selection[eq.id] ?? 0) > 0 ? " is-selected" : "")
                      }
                      key={eq.id}
                    >
                      <div className="loan-equipment-photo">
                        {eq.photo ? (
                          <img
                            src={eq.photo}
                            alt={equipmentDisplayName(eq)}
                            width={480}
                            height={360}
                            loading="lazy"
                          />
                        ) : (
                          <div className="loan-equipment-placeholder">
                            <Package size={40} aria-hidden="true" />
                            <span>Foto belum tersedia</span>
                          </div>
                        )}
                      </div>
                      <div className="loan-equipment-info">
                        <small className="loan-equipment-code">{eq.code}</small>
                        <h3>{eq.name}</h3>
                        <p className="loan-equipment-type">
                          Jenis: <strong>{eq.typeColor || "Belum dicatat"}</strong>
                        </p>
                        {eq.brand && <p>{eq.brand}</p>}
                        <p>{eq.category}</p>
                        <p>{eq.available ? "Tersedia" : "Tidak tersedia saat ini"}</p>
                        <p>
                          Maksimal {eq.maxDays} hari · {eq.maxQuantity} per pengajuan
                        </p>
                      </div>
                      <div className="loan-equipment-quantity">
                        <label htmlFor={eq.id}>Jumlah diminta</label>
                        <input
                          id={eq.id}
                          type="number"
                          min={0}
                          max={eq.maxQuantity}
                          disabled={!eq.available}
                          aria-label={"Jumlah " + equipmentDisplayName(eq) + " " + eq.code}
                          value={selection[eq.id] ?? 0}
                          onChange={(e) => {
                            key.current = null;
                            setSelection({
                              ...selection,
                              [eq.id]: Math.max(
                                0,
                                Math.min(eq.maxQuantity, Math.floor(Number(e.target.value) || 0)),
                              ),
                            });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {!filtered.length && (
                  <Empty title="Alat tidak ditemukan" description="Coba nama atau kategori lain." />
                )}
              </>
            ) : (
              <>
                <div className="paper-summary">
                  <h2>Data peminjaman</h2>
                  <div className="data-grid">
                    {loanFields.map(([key, label]) => (
                      <div key={key}>
                        <small>{label}</small>
                        <p>{fields[key]}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Alat</th>
                        <th>Jumlah diminta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chosen.map((eq) => (
                        <tr key={eq.id}>
                          <td>
                            {equipmentDisplayName(eq)}
                            <br />
                            <small>{eq.code}</small>
                          </td>
                          <td>{selection[eq.id]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Consent />
              </>
            )}
            {step !== 0 && actions}
          </form>
          <aside className="form-aside">
            {asideInfo}
            {step === 0 && actions}
          </aside>
        </section>
      )}
    </>
  );
}
type LookupRecord = {
  code: string;
  status?: string;
  institution?: string;
  pic?: string;
  start?: string;
  end?: string;
  notes?: string;
  penalty?: number;
  items?: Array<{
    name: string;
    code?: string;
    equipmentDeleted?: boolean;
    requested: number;
    approved: number;
  }>;
  history?: Array<{ status: string; note: string; at: string }>;
  fields?: Record<string, string>;
  revisions?: number;
  year?: number;
};
const labels: Record<string, string> = {
  requested: "Diajukan",
  approved: "Disetujui",
  borrowed: "Dipinjam",
  awaiting_return: "Menunggu verifikasi pengembalian",
  late: "Terlambat",
  returned: "Dikembalikan",
  rejected: "Ditolak",
};
export function LoanTracking({ initialCode = "" }: { initialCode?: string }) {
  const t = usePublicTransport(),
    [code, setCode] = useState(initialCode),
    [phone, setPhone] = useState(""),
    [found, setFound] = useState<{
      record: LookupRecord;
      capability: string;
    } | null>(null),
    [note, setNote] = useState("");
  return (
    <>
      <PageIntro
        title={"Perjalanan\npengajuanmu."}
        description="Kode pengajuan dan nomor telepon terdaftar diperlukan untuk melihat pengajuan."
      />
      <section className="container form-section stack">
        <form
          className="lookup-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setFound(null);
            try {
              setFound(await t.post("lookup", { kind: "loan", code, phone }));
            } catch {}
          }}
        >
          <Field
            label="Kode pengajuan"
            required
            maxLength={40}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <Field
            label="Nomor telepon terdaftar"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button className="btn primary" disabled={t.busy}>
            Lihat pengajuan
          </button>
        </form>
        {found && (
          <>
            <div className="paper-summary">
              <h2>{found.record.code}</h2>
              <p>{labels[found.record.status ?? ""] ?? found.record.status}</p>
              <p>
                {found.record.institution} · {found.record.pic}
              </p>
              <p>
                {found.record.start && date(found.record.start)} —{" "}
                {found.record.end && date(found.record.end)}
              </p>
              <p>{found.record.notes}</p>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Alat</th>
                    <th>Diminta</th>
                    <th>Disetujui</th>
                  </tr>
                </thead>
                <tbody>
                  {found.record.items?.map((item, i) => (
                    <tr key={i}>
                      <td>
                        {item.name}
                        {item.equipmentDeleted && <p>Alat telah dihapus dari inventaris</p>}
                        {item.code && (
                          <>
                            <br />
                            <small>{item.code}</small>
                          </>
                        )}
                      </td>
                      <td>{item.requested}</td>
                      <td>{item.approved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {found.record.history?.map((h, i) => (
              <p key={i}>
                {labels[h.status] ?? h.status} — {h.note}
              </p>
            ))}
            {["approved", "borrowed", "late", "awaiting_return", "returned"].includes(
              found.record.status ?? "",
            ) && (
              <button
                className="btn secondary"
                disabled={t.busy}
                onClick={async () => {
                  try {
                    const blob = await t.post<Blob>("invoice", {
                      capability: found.capability,
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = found.record.code + ".pdf";
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  } catch {}
                }}
              >
                Unduh invoice PDF
              </button>
            )}
            {["borrowed", "late"].includes(found.record.status ?? "") && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await t.post("return", {
                      capability: found.capability,
                      note,
                    });
                    setFound({
                      ...found,
                      record: { ...found.record, status: "awaiting_return" },
                    });
                  } catch {}
                }}
              >
                <Textarea label="Catatan pengembalian" value={note} onChange={setNote} />
                <button className="btn primary" disabled={t.busy}>
                  Ajukan pengembalian
                </button>
              </form>
            )}
          </>
        )}
        {t.error && <Notice tone="error">{t.error}</Notice>}
      </section>
    </>
  );
}
export function Invoice({ code }: { code: string }) {
  return <LoanTracking initialCode={code} />;
}
const extraFields = [
  ["nama_orangtua", "Nama orang tua"],
  ["telepon_orangtua", "Nomor telepon orang tua"],
  ["motivasi", "Motivasi"],
  ["pengalaman_organisasi", "Pengalaman organisasi"],
  ["riwayat_penyakit", "Riwayat penyakit"],
];
export function Recruitment() {
  const state = useDemo(),
    t = usePublicTransport(),
    [fields, setFields] = useState<Record<string, string>>({}),
    [photo, setPhoto] = useState(""),
    [code, setCode] = useState(""),
    [lookup, setLookup] = useState({ code: "", phone: "" }),
    [edit, setEdit] = useState<{
      capability: string;
      revisions: number;
    } | null>(null),
    key = useRef<string | null>(null);
  const year = Number(state.settings.period.replace(/\D/g, ""));
  if (!state.settings.recruitmentActive)
    return (
      <div className="container section">
        <Empty
          title="Pendaftaran sedang ditutup"
          description="Open Recruitment tampil kembali ketika periode dibuka."
        />
      </div>
    );
  if (code) return <Receipt code={code} />;
  const selectors: Record<string, string[]> = {
    jenis_kelamin: ["Laki-laki", "Perempuan"],
    golongan_darah: ["A", "B", "AB", "O", "Tidak tahu"],
  };
  return (
    <>
      <PageIntro
        title={"Mulai perjalananmu\nbersama WAPALA."}
        description={"Open Recruitment · Periode " + year}
      />
      <section className="container form-section stack">
        <details>
          <summary>Sudah mendaftar? Periksa atau revisi data</summary>
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const result = await t.post<{
                  record: LookupRecord;
                  capability: string;
                }>("lookup", { kind: "recruitment", ...lookup });
                setFields(result.record.fields ?? {});
                setEdit({
                  capability: result.capability,
                  revisions: result.record.revisions ?? 0,
                });
              } catch {}
            }}
          >
            <Field
              label="Kode pendaftaran"
              required
              value={lookup.code}
              onChange={(e) => setLookup({ ...lookup, code: e.target.value })}
            />
            <Field
              label="Nomor telepon terdaftar"
              required
              type="tel"
              value={lookup.phone}
              onChange={(e) => setLookup({ ...lookup, phone: e.target.value })}
            />
            <button className="btn secondary" disabled={t.busy}>
              Periksa pendaftaran
            </button>
          </form>
        </details>
        <form
          className="form-main stack"
          onSubmit={async (e) => {
            e.preventDefault();
            key.current ??= crypto.randomUUID();
            try {
              if (edit) {
                await t.post("revise", { ...edit, fields });
                setCode(lookup.code);
              } else {
                if (!photo) {
                  t.setError("Unggah pas foto sebelum mengirim.");
                  return;
                }
                const result = await t.post<{ code: string }>("submit", {
                  kind: "recruitment",
                  idempotencyKey: key.current,
                  consent: true,
                  payload: {
                    year,
                    fields: {
                      pengalaman_organisasi: "",
                      riwayat_penyakit: "",
                      ...fields,
                    },
                    photo,
                  },
                });
                setCode(result.code);
              }
            } catch {}
          }}
        >
          <div className="form-grid">
            {[...orPersonal, ...orAcademic, ...extraFields].map(([field, label]) =>
              selectors[field] ? (
                <Select
                  key={field}
                  label={label}
                  required
                  options={selectors[field]}
                  value={fields[field] ?? ""}
                  onChange={(value) => {
                    key.current = null;
                    setFields({ ...fields, [field]: value });
                  }}
                />
              ) : (
                <Field
                  key={field}
                  label={label}
                  type={
                    field === "tanggal_lahir"
                      ? "date"
                      : field === "email"
                        ? "email"
                        : field.startsWith("telepon")
                          ? "tel"
                          : "text"
                  }
                  required={!["pengalaman_organisasi", "riwayat_penyakit"].includes(field)}
                  disabled={!!edit && ["nim", "telepon", "email"].includes(field)}
                  maxLength={
                    ["motivasi", "pengalaman_organisasi", "riwayat_penyakit"].includes(field)
                      ? 2000
                      : 300
                  }
                  value={fields[field] ?? ""}
                  onChange={(e) => {
                    key.current = null;
                    setFields({ ...fields, [field]: e.target.value });
                  }}
                />
              ),
            )}
          </div>
          <Consent />
          {t.error && edit && <Notice tone="error">{t.error}</Notice>}
          {!edit && (
            <PublicUpload
              label="Pas foto"
              purpose="applicant-photo"
              scope={String(year)}
              transport={t}
              onUploaded={setPhoto}
            />
          )}
          <button className="btn primary" disabled={t.busy || (!edit && !photo)}>
            {edit ? "Simpan revisi" : "Kirim pendaftaran"}
          </button>
        </form>
      </section>
    </>
  );
}
export function DonationForm({ campaignId }: { campaignId: string }) {
  const state = useDemo(),
    t = usePublicTransport(),
    campaign = state.campaigns.find((c) => c.id === campaignId),
    [fields, setFields] = useState({
      name: "",
      amount: "",
      method: "",
      bankAccountId: "",
    }),
    [proof, setProof] = useState(""),
    [done, setDone] = useState(false),
    key = useRef<string | null>(null),
    banks = campaign ? getBankAccounts(campaign) : [];
  if (!campaign || !canConfirmDonation(state, campaignId))
    return (
      <div className="container section">
        <Empty
          title="Belum ada kampanye aktif"
          description="Kampanye akan tampil setelah dibuka oleh admin."
        />
      </div>
    );
  return (
    <>
      <PageIntro title={campaign.title} description={campaign.description} />
      <section className="container form-section form-layout">
        <form
          className="form-main stack"
          onSubmit={async (e) => {
            e.preventDefault();
            key.current ??= crypto.randomUUID();
            try {
              await t.post("submit", {
                kind: "donation",
                idempotencyKey: key.current,
                consent: true,
                payload: {
                  campaignId,
                  name: fields.name,
                  amount: Number(fields.amount),
                  method: fields.method,
                  ...(fields.method === "bank" ? { bankAccountId: fields.bankAccountId } : {}),
                  proof,
                },
              });
              setDone(true);
            } catch {}
          }}
        >
          {done ? (
            <Notice>Konfirmasi diterima dan menunggu verifikasi pengelola.</Notice>
          ) : (
            <>
              <h2>Konfirmasi donasi</h2>
              <Field
                label="Nama"
                required
                maxLength={200}
                value={fields.name}
                onChange={(e) => {
                  key.current = null;
                  setFields({ ...fields, name: e.target.value });
                }}
              />
              <Field
                label="Nominal transfer"
                type="number"
                min={1}
                max={1000000000000}
                required
                value={fields.amount}
                onChange={(e) => {
                  key.current = null;
                  setFields({ ...fields, amount: e.target.value });
                }}
              />
              <label className="field">
                Metode transfer
                <select
                  required
                  value={fields.method}
                  onChange={(e) => {
                    key.current = null;
                    setFields({ ...fields, method: e.target.value });
                  }}
                >
                  <option value="">Pilih metode</option>
                  {banks.length > 0 && <option value="bank">Transfer bank</option>}
                  {campaign.qrisImage && <option value="qris">QRIS</option>}
                </select>
              </label>
              {fields.method === "bank" && (
                <label className="field">
                  Rekening tujuan
                  <select
                    required
                    value={fields.bankAccountId}
                    onChange={(e) => {
                      key.current = null;
                      setFields({ ...fields, bankAccountId: e.target.value });
                    }}
                  >
                    <option value="">Pilih rekening</option>
                    {banks.map((bank) => (
                      <option key={bank.id} value={bank.id}>
                        {bank.bank} · {bank.number} · a.n. {bank.holder}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <Consent />
              <PublicUpload
                label="Bukti transfer"
                purpose="donation-proof"
                scope={campaignId}
                transport={t}
                onUploaded={setProof}
              />
              <button className="btn primary" disabled={t.busy || !proof}>
                Kirim konfirmasi
              </button>
            </>
          )}
        </form>
        <aside className="form-aside">
          <h2>Tujuan donasi</h2>
          <p>{campaign.description}</p>
          <p>
            {money(campaignTotal(state.donations, campaignId))} terverifikasi dari target{" "}
            {money(campaign.target)}
          </p>
          {campaign.poster && (
            <img src={campaign.poster} alt="Poster donasi" width={600} height={800} />
          )}
          <h3>Rekening penerima</h3>
          {banks.map((bank) => (
            <div key={bank.id}>
              <p>{bank.bank}</p>
              <p>{bank.number}</p>
              <p>a.n. {bank.holder}</p>
            </div>
          ))}
          {campaign.qrisImage && (
            <img src={campaign.qrisImage} alt={"QRIS " + campaign.title} width={400} height={400} />
          )}
          <p>Hanya donasi yang diverifikasi pengelola menambah total kampanye.</p>
        </aside>
      </section>
    </>
  );
}
