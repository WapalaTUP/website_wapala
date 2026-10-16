"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Empty, Field, Notice, Textarea, Modal, Upload } from "../ui";
import { backendApi, uploadMedia } from "./api";
import type { listArchives } from "@/server/domains/archives";
type AuditRow = {
  id: string;
  action: string;
  actorType: string;
  actorId: string | null;
  entityId: string | null;
  createdAt: string;
  summary: unknown;
};
export function BackendAudit({
  initial,
  csrfToken,
}: {
  initial: { rows: AuditRow[]; cursor: string | null };
  csrfToken: string;
}) {
  const [data, setData] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function load() {
    if (!data.cursor || busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await backendApi<typeof initial>(
        "/api/admin/audit?limit=50&cursor=" + encodeURIComponent(data.cursor),
        csrfToken,
      );
      setData((old) => ({
        rows: [...old.rows, ...next.rows],
        cursor: next.cursor,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audit belum dapat dimuat.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Notice>
        Audit bersifat append-only. Password, token, dan kredensial tidak ditampilkan di sini.
      </Notice>
      {error && <Notice tone="error">{error}</Notice>}
      {data.rows.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Aksi</th>
                <th>Aktor</th>
                <th>Entitas / ringkasan</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {new Date(r.createdAt).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                    })}
                  </td>
                  <td>{r.action}</td>
                  <td>
                    {r.actorType}
                    <br />
                    {r.actorId || "—"}
                  </td>
                  <td>
                    {r.entityId || "—"}
                    <br />
                    <small>{JSON.stringify(r.summary)}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="Belum ada aktivitas audit"
          description="Operasi organisasi akan tercatat otomatis."
        />
      )}
      {data.cursor && (
        <button className="btn secondary" disabled={busy} onClick={() => void load()}>
          {busy ? "Memuat…" : "Muat aktivitas sebelumnya"}
        </button>
      )}
    </>
  );
}
export function BackendSettings({
  initialConfig,
  csrfToken,
}: {
  initialConfig: Record<string, string>;
  csrfToken: string;
}) {
  const [fields, setFields] = useState({
      organization: initialConfig.organization || "",
      email: initialConfig.email || "",
      address: initialConfig.address || "",
      whatsapp: initialConfig.whatsapp || "",
      map: initialConfig.map || "",
      instagram: initialConfig.instagram || "",
      tiktok: initialConfig.tiktok || "",
      youtube: initialConfig.youtube || "",
      profileHistory: initialConfig.profileHistory || "",
      profileVision: initialConfig.profileVision || "",
      profileMissions: initialConfig.profileMissions || "",
      logoUrl: initialConfig.logoUrl || "",
      telULogoUrl: initialConfig.telULogoUrl || "",
      identityImageUrl: initialConfig.identityImageUrl || "",
      divisionImageUrl: initialConfig.divisionImageUrl || "",
      divisionImageUrl1: initialConfig.divisionImageUrl1 || "",
      divisionImageUrl2: initialConfig.divisionImageUrl2 || "",
      divisionImageUrl3: initialConfig.divisionImageUrl3 || "",
      divisionImageUrl4: initialConfig.divisionImageUrl4 || "",
      jumbotronUrl: initialConfig.jumbotronUrl || "",
      logoMeaningImageUrl: initialConfig.logoMeaningImageUrl || "",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const router = useRouter();
  const uploadBranding = async (
    key:
      | "logoUrl"
      | "telULogoUrl"
      | "identityImageUrl"
      | "divisionImageUrl"
      | "divisionImageUrl1"
      | "divisionImageUrl2"
      | "divisionImageUrl3"
      | "divisionImageUrl4"
      | "jumbotronUrl"
      | "logoMeaningImageUrl",
    files: File[],
  ) => {
    const file = files[0];
    if (!file) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const url = await uploadMedia(file, "branding", csrfToken);
      setFields((old) => ({ ...old, [key]: url }));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Foto belum dapat diunggah.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setSaved(false);
        setError("");
        try {
          await backendApi(
            "/api/admin/settings",
            csrfToken,
            {
              organization: fields.organization,
              email: fields.email,
              address: fields.address,
              map: fields.map,
              instagram: fields.instagram,
              tiktok: fields.tiktok,
              youtube: fields.youtube,
              profileHistory: fields.profileHistory,
              profileVision: fields.profileVision,
              profileMissions: fields.profileMissions,
              logoUrl: fields.logoUrl,
              telULogoUrl: fields.telULogoUrl,
              identityImageUrl: fields.identityImageUrl,
              divisionImageUrl: fields.divisionImageUrl,
              divisionImageUrl1: fields.divisionImageUrl1,
              divisionImageUrl2: fields.divisionImageUrl2,
              divisionImageUrl3: fields.divisionImageUrl3,
              divisionImageUrl4: fields.divisionImageUrl4,
              jumbotronUrl: fields.jumbotronUrl,
              logoMeaningImageUrl: fields.logoMeaningImageUrl,
              ...(fields.whatsapp ? { whatsapp: fields.whatsapp } : {}),
            },
            "PATCH",
          );
          setSaved(true);
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Pengaturan belum dapat disimpan.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        {(
          [
            ["logoUrl", "Logo WAPALA"],
            ["telULogoUrl", "Logo Telkom University"],
            ["identityImageUrl", "Gambar identitas"],
            ["divisionImageUrl1", "Foto divisi — Gunung Hutan"],
            ["divisionImageUrl2", "Foto divisi — Rock Climbing"],
            ["divisionImageUrl3", "Foto divisi — Caving"],
            ["divisionImageUrl4", "Foto divisi — Rafting"],
            ["jumbotronUrl", "Banner OR"],
            ["logoMeaningImageUrl", "Gambar arti logo"],
          ] as const
        ).map(([key, label]) => (
          <div className="settings-image-field" key={key}>
            <Upload
              label={label}
              kind="photo"
              names={fields[key] ? ["Gambar tersimpan — pilih untuk mengganti"] : []}
              onFiles={(files) => void uploadBranding(key, files)}
              error=""
              setError={setError}
            />
            {fields[key] && (
              <div className="settings-image-status">
                <span>Siap diterapkan saat Pengaturan disimpan.</span>
                <button
                  type="button"
                  className="text-button danger-text"
                  disabled={busy}
                  onClick={() => setFields((old) => ({ ...old, [key]: "" }))}
                >
                  Hapus gambar
                </button>
              </div>
            )}
          </div>
        ))}
        {(["profileHistory", "profileVision", "profileMissions"] as const).map((key) => (
          <Textarea
            key={key}
            label={
              key === "profileHistory"
                ? "Sejarah organisasi"
                : key === "profileVision"
                  ? "Visi organisasi"
                  : "Misi organisasi (satu per baris)"
            }
            value={fields[key]}
            onChange={(value) => setFields({ ...fields, [key]: value.slice(0, 10000) })}
          />
        ))}
        {(["map", "instagram", "tiktok", "youtube"] as const).map((key) => (
          <Field
            key={key}
            label={key === "map" ? "Tautan peta sekretariat" : key}
            type="url"
            maxLength={2000}
            value={fields[key]}
            hint="Tautan HTTPS; kosongkan untuk menghapus."
            onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
          />
        ))}
        <Field
          label="Nama organisasi"
          required
          value={fields.organization}
          maxLength={150}
          onChange={(e) => setFields({ ...fields, organization: e.target.value })}
        />
        <Field
          label="Email organisasi"
          type="email"
          required
          value={fields.email}
          onChange={(e) => setFields({ ...fields, email: e.target.value })}
        />
        <Field
          label="Alamat sekretariat"
          value={fields.address}
          maxLength={500}
          onChange={(e) => setFields({ ...fields, address: e.target.value })}
        />
        <Field
          label="WhatsApp organisasi"
          type="tel"
          value={fields.whatsapp}
          hint="Gunakan angka, dapat diawali +."
          onChange={(e) => setFields({ ...fields, whatsapp: e.target.value })}
        />
      </div>
      <Notice>
        Periode Open Recruitment dan kampanye dibuka dari modul masing-masing. Kredensial server
        tidak dikelola melalui form ini.
      </Notice>
      {error && <Notice tone="error">{error}</Notice>}
      {saved && <Notice>Pengaturan tersimpan di database.</Notice>}
      <button className="btn primary" disabled={busy}>
        {busy ? "Menyimpan…" : "Simpan pengaturan"}
      </button>
    </form>
  );
}
export function BackendArchives({
  rows,
  csrfToken,
}: {
  rows: Awaited<ReturnType<typeof listArchives>>;
  csrfToken: string;
}) {
  const [search, setSearch] = useState(""),
    [data, setData] = useState(rows),
    [selected, setSelected] = useState<(typeof rows)[number] | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const visible = data.filter((r) =>
    (r.title + " " + r.kind).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <Notice>
        Arsip tetap tersimpan di database. Peminjaman aktif, denda belum lunas, dan jaminan tertahan
        tidak diarsipkan oleh pergantian kepengurusan. Menampilkan hingga 100 arsip terbaru per
        jenis.
      </Notice>
      <Field label="Cari arsip" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="button-row">
        <a download className="btn secondary" href="/api/admin/export/archives?format=xlsx">
          Ekspor daftar Excel
        </a>
        <a download className="btn secondary" href="/api/admin/export/archives?format=pdf">
          Ekspor daftar PDF
        </a>
        <a
          download
          className="btn secondary"
          href="/api/admin/export/members?format=xlsx&archived=true"
        >
          Ekspor anggota arsip
        </a>
        <a
          download
          className="btn secondary"
          href="/api/admin/export/inventory?format=xlsx&archived=true"
        >
          Ekspor inventaris arsip
        </a>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {visible.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Jenis</th>
                <th>Nama / kode</th>
                <th>Diarsipkan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.kind + r.id}>
                  <td>{r.kind}</td>
                  <td>{r.title}</td>
                  <td>
                    {new Date(r.at).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                    })}
                  </td>
                  <td>
                    <button
                      className="btn secondary"
                      disabled={busy}
                      onClick={() => setSelected(r)}
                    >
                      Pulihkan
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="Belum ada arsip pada filter ini"
          description="Data yang diarsipkan melalui modul organisasi akan tampil di sini."
        />
      )}
      <Modal
        open={!!selected}
        title="Pulihkan arsip"
        onClose={() => {
          if (!busy) setSelected(null);
        }}
      >
        <p>
          Pulihkan {selected?.title}? Riwayat tetap disimpan. Konten dan kampanye dipulihkan sebagai
          draft; inventaris perlu diaktifkan kembali dari modul inventaris.
        </p>
        <button
          className="btn primary"
          disabled={busy}
          onClick={async () => {
            if (!selected) return;
            setBusy(true);
            setError("");
            try {
              await backendApi("/api/admin/archives", csrfToken, {
                id: selected.id,
                kind: selected.kind,
                at: selected.at,
              });
              const next = await backendApi<{ rows: typeof rows }>(
                "/api/admin/archives",
                csrfToken,
              );
              setData(next.rows);
              setSelected(null);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Arsip belum dapat dipulihkan.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Memulihkan…" : "Konfirmasi pemulihan"}
        </button>
      </Modal>
    </>
  );
}
