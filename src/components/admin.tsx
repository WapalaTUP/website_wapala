"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  Archive,
  BookOpen,
  Boxes,
  ClipboardList,
  FileText,
  Heart,
  ImageIcon,
  Menu,
  Pencil,
  Settings,
  Shield,
  Trash2,
  Users,
  UserPlus,
  Plus,
  LogOut,
  Bell,
} from "lucide-react";
import type { DemoState, Equipment, Loan, Module, RecordRow, Role } from "@/lib/types";
import { canAccess, canEdit, canTransition, latePenalty, permissions } from "@/lib/domain";
import { albums, books, conditions, date, money, photos } from "@/lib/content";
import { useDemo, updateStore, resetStore } from "@/lib/store";
import { roles, setRole, useRole } from "@/lib/admin-role";
import { applicantExportRow } from "@/lib/recruitment-fields";
import { annualPeriod } from "@/lib/periods";
import { CampaignAdmin } from "./campaign-admin";
import { ImportDialog } from "./import-dialog";
import { ManagementReset } from "./management-reset";
import { exportRows, invoicePdf, applicantPdf } from "@/lib/exports";
import { Logo, ThemeButton } from "./shell";
import { useToast } from "./providers";
import { Badge, Empty, Field, Modal, Notice, Pagination, Select, Textarea } from "./ui";
const moduleInfo: Record<Module, { title: string; description: string; icon: typeof Users }> = {
  kepengurusan: {
    title: "Reset periode kepengurusan",
    description: "Serah terima arsip peminjaman dan permintaan akses admin.",
    icon: Archive,
  },
  anggota: {
    title: "Anggota",
    description: "Data internal anggota. Semua baris pada preview adalah contoh fiktif.",
    icon: Users,
  },
  konten: {
    title: "Berita & pengumuman",
    description: "Tulis, terbitkan, dan arsipkan cerita organisasi.",
    icon: FileText,
  },
  galeri: {
    title: "Galeri",
    description: "Album, kategori kegiatan, lokasi, dan dokumentasi.",
    icon: ImageIcon,
  },
  buku: {
    title: "Buku publik",
    description: "Metadata dan bahan bacaan PDF / EPUB.",
    icon: BookOpen,
  },
  or: {
    title: "Open Recruitment",
    description: "Periode dan pendaftar calon anggota.",
    icon: UserPlus,
  },
  inventaris: {
    title: "Inventaris",
    description: "Katalog alat, kondisi, dan ketersediaan publik.",
    icon: Boxes,
  },
  peminjaman: {
    title: "Peminjaman",
    description: "Tinjau pengajuan dan pemeriksaan pengembalian.",
    icon: ClipboardList,
  },
  donasi: {
    title: "Kampanye & donasi",
    description: "Kelola kampanye, buka atau tutup donasi, dan verifikasi konfirmasi transfer.",
    icon: Heart,
  },
  pengguna: {
    title: "Pengguna",
    description: "Akun admin dan tingkat izin.",
    icon: Shield,
  },
  pengaturan: {
    title: "Pengaturan",
    description: "Kontak dan konfigurasi publik.",
    icon: Settings,
  },
  arsip: {
    title: "Arsip",
    description: "Pulihkan record atau hapus permanen dengan alasan.",
    icon: Archive,
  },
  audit: {
    title: "Audit log",
    description: "Riwayat perubahan serta akses ekspor.",
    icon: Shield,
  },
};
export function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@wapala.id");
  const [password, setPassword] = useState("");
  const [role, chooseRole] = useState<Role>("Super User");
  const [error, setError] = useState("");
  return (
    <main className="login-layout">
      <section className="login-visual">
        <img src={photos.rafting} alt="Dokumentasi rafting WAPALA" />
        <div>
          <h1>
            Setiap perjalanan
            <br />
            berawal dari
            <br />
            persiapan.
          </h1>
          <p>Portal pengelolaan Wahana Pencinta Alam Telkom University.</p>
        </div>
      </section>
      <section className="login-form">
        <div>
          <Logo />
          <h2>Masuk ke portal.</h2>
          <p>Gunakan akun preview untuk mencoba alur admin.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email !== "demo@wapala.id" || password !== "wapala-demo") {
                setError("Gunakan email demo@wapala.id dan password wapala-demo.");
                return;
              }
              setRole(role);
              router.push("/admin/" + permissions[role][0]);
            }}
          >
            <Field
              label="Email admin"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Field
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Select
              label="Role preview"
              options={roles}
              value={role}
              onChange={(v) => chooseRole(v as Role)}
            />
            {error && <Notice tone="error">{error}</Notice>}
            <button className="btn primary">Masuk</button>
          </form>
          <Notice>
            Preview saja. Password: <strong>wapala-demo</strong>. Autentikasi dan izin server akan
            diterapkan pada tahap backend.
          </Notice>
          <Link className="text-link" href="/" style={{ marginTop: 20 }}>
            Kembali ke website
          </Link>
        </div>
      </section>
    </main>
  );
}
export function Admin({ moduleName }: { moduleName: string }) {
  const state = useDemo();
  const role = useRole();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [notifications, setNotifications] = useState(false);
  if (!role)
    return (
      <div className="container section">
        <Empty
          title="Portal organisasi"
          description="Masuk dengan akun preview untuk melihat antarmuka admin."
          action={
            <Link className="btn primary" href="/wapala">
              Masuk ke portal
            </Link>
          }
        />
      </div>
    );
  const activeModule = (moduleName || permissions[role][0]) as Module;
  const info = moduleInfo[activeModule];
  const allowed = info && canAccess(role, activeModule);
  return (
    <div className="admin-layout">
      <aside className={"admin-sidebar" + (menu ? " open" : "")}>
        <Logo />
        <nav aria-label="Modul admin">
          {permissions[role].map((m) => {
            const Icon = moduleInfo[m].icon;
            return (
              <Link
                href={"/admin/" + m}
                key={m}
                className={activeModule === m ? "active" : ""}
                onClick={() => setMenu(false)}
              >
                <Icon size={17} />
                {moduleInfo[m].title}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <p>
            {role}
            <br />
            Mode preview
          </p>
          <Link className="text-link" href="/">
            Lihat website
          </Link>
          <button
            className="btn secondary"
            onClick={() => {
              setRole("");
              router.push("/wapala");
            }}
          >
            <LogOut size={15} />
            Keluar
          </button>
        </div>
      </aside>
      <div className="admin-body">
        <header className="admin-topbar">
          <div>
            <button
              className="icon-btn admin-mobile-menu"
              onClick={() => setMenu(!menu)}
              aria-label="Buka navigasi admin"
            >
              <Menu />
            </button>
            <span className="breadcrumb">Portal organisasi / {info?.title || "Modul"}</span>
          </div>
          <div>
            <select
              aria-label="Role preview"
              value={role}
              onChange={(e) => {
                const r = e.target.value as Role;
                setRole(r);
                router.push("/admin/" + permissions[r][0]);
              }}
            >
              {roles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <button
              className="icon-btn"
              aria-label="Notifikasi"
              onClick={() => setNotifications(true)}
            >
              <Bell size={19} />
            </button>
            <ThemeButton />
          </div>
        </header>
        <main className="admin-main" id="main">
          {allowed ? (
            <>
              <div className="admin-page-header">
                <div>
                  <h1>{info.title}</h1>
                  <p>{info.description}</p>
                </div>
                <Badge>{role}</Badge>
              </div>
              {activeModule === "kepengurusan" ? (
                <ManagementReset role={role} />
              ) : activeModule === "inventaris" ? (
                <Inventory role={role} />
              ) : activeModule === "peminjaman" ? (
                <Loans role={role} />
              ) : activeModule === "or" ? (
                <RecruitmentAdmin role={role} />
              ) : activeModule === "donasi" ? (
                <CampaignAdmin role={role} />
              ) : activeModule === "pengaturan" ? (
                <SettingsAdmin role={role} />
              ) : activeModule === "arsip" ? (
                <Archives role={role} />
              ) : activeModule === "audit" ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Waktu</th>
                        <th>Aktor</th>
                        <th>Aksi</th>
                        <th>Record</th>
                        <th>Alasan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.audit.map((a) => (
                        <tr key={a.id}>
                          <td>{date(a.at)}</td>
                          <td>{a.actor}</td>
                          <td>{a.action}</td>
                          <td>{a.target}</td>
                          <td>{a.reason || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Records module={activeModule} role={role} />
              )}
              <p className="role-notice">
                Izin pada versi ini mengatur UI preview. Validasi izin di server merupakan bagian
                dari tahap backend.
              </p>
            </>
          ) : (
            <Empty
              title="Modul tidak tersedia untuk role ini"
              description="Pilih modul dari navigasi yang sesuai dengan izin preview."
            />
          )}
        </main>
      </div>
      <Modal
        open={notifications}
        title="Notifikasi organisasi"
        onClose={() => setNotifications(false)}
      >
        <div className="stack">
          {state.loans
            .filter((l) => l.status === "Diajukan")
            .map((l) => (
              <Notice key={l.id}>
                Pengajuan baru {l.code} — {l.institution}
              </Notice>
            ))}
          {state.donations
            .filter((d) => d.status === "Menunggu")
            .map((d) => (
              <Notice key={d.id}>Konfirmasi donasi {money(d.amount)} menunggu pemeriksaan.</Notice>
            ))}
        </div>
      </Modal>
    </div>
  );
}
type FieldDef = {
  key: string;
  label: string;
  options?: string[];
  type?: string;
};
const definitions: Record<string, FieldDef[]> = {
  anggota: [
    { key: "nama", label: "Nama" },
    { key: "nim", label: "NIM" },
    { key: "prodi", label: "Prodi" },
    { key: "angkatan", label: "Angkatan" },
    {
      key: "jenis_kelamin",
      label: "Jenis kelamin",
      options: ["Laki-laki", "Perempuan"],
    },
    { key: "nia", label: "NIA" },
    { key: "status", label: "Status", options: ["Aktif", "ALB", "AK"] },
    { key: "kontak", label: "Kontak" },
  ],
  konten: [
    { key: "judul", label: "Judul" },
    { key: "slug", label: "Slug" },
    { key: "tipe", label: "Tipe", options: ["Berita", "Announcement"] },
    { key: "kategori", label: "Kategori" },
    { key: "penulis", label: "Penulis" },
    { key: "tanggal", label: "Tanggal terbit", type: "date" },
    { key: "sampul", label: "Sampul", options: Object.values(photos) },
    { key: "status", label: "Status", options: ["Draft", "Publik"] },
    { key: "ringkasan", label: "Ringkasan" },
    { key: "isi", label: "Isi artikel" },
  ],
  galeri: [
    { key: "judul", label: "Judul" },
    { key: "kategori", label: "Kategori" },
    { key: "lokasi", label: "Lokasi" },
    {
      key: "sampul",
      label: "Foto sampul / highlight",
      options: albums.flatMap((a) => a.images),
    },
    { key: "deskripsi", label: "Deskripsi" },
    { key: "tanggal", label: "Tanggal kegiatan", type: "date" },
    { key: "tanggal_upload", label: "Tanggal unggah", type: "date" },
    {
      key: "highlight",
      label: "Jadikan highlight beranda",
      options: ["Tidak", "Ya"],
    },
  ],
  buku: [
    { key: "judul", label: "Judul" },
    { key: "kategori", label: "Kategori" },
    { key: "deskripsi", label: "Deskripsi" },
    { key: "file", label: "Berkas", options: books.map((b) => b.file) },
  ],
  pengguna: [
    { key: "nama", label: "Nama admin" },
    { key: "email", label: "Email", type: "email" },
    { key: "role", label: "Role", options: roles },
    {
      key: "status",
      label: "Status",
      options: ["Aktif", "Nonaktif", "Terkunci"],
    },
  ],
};
function rowsFor(module: string, state: DemoState): RecordRow[] {
  if (module === "galeri") {
    const base = albums.map((a) => ({
      id: a.id,
      fields: {
        judul: a.title,
        kategori: a.category,
        lokasi: a.location,
        sampul: a.image,
        deskripsi: a.description,
      },
    }));
    return [
      ...base.filter((a) => !state.records.galeri.some((r) => r.id === a.id)),
      ...state.records.galeri,
    ];
  }
  if (module === "buku") {
    const base = books.map((b) => ({
      id: b.id,
      fields: {
        judul: b.title,
        kategori: b.category,
        deskripsi: b.description,
        file: b.file,
      },
    }));
    return [
      ...base.filter((b) => !state.records.buku.some((r) => r.id === b.id)),
      ...state.records.buku,
    ];
  }
  return state.records[module] || [];
}
function Records({ module, role }: { module: Module; role: Role }) {
  const state = useDemo();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<RecordRow | null>(null);
  const [archive, setArchive] = useState<RecordRow | null>(null);
  const defs = definitions[module] || [];
  const rows = rowsFor(module, state).filter(
    (r) =>
      !r.archived && Object.values(r.fields).join(" ").toLowerCase().includes(search.toLowerCase()),
  );
  const columns = defs.slice(0, 4);
  async function exportData(format: "xlsx" | "pdf") {
    try {
      await exportRows(
        moduleInfo[module].title,
        rows.map((r) => r.fields),
        format,
      );
      updateStore(() => {}, "Ekspor " + format, module, role);
      toast("Ekspor dibuat.");
    } catch {
      toast("Ekspor belum dapat dibuat.");
    }
  }
  function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    try {
      updateStore(
        (d) => {
          const all = rowsFor(module, d);
          const index = all.findIndex((r) => r.id === draft.id);
          if (index >= 0) all[index] = draft;
          else all.unshift(draft);
          d.records[module] = all;
        },
        "Menyimpan " + module,
        draft.id,
        role,
      );
      setDraft(null);
      toast("Perubahan disimpan.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Data gagal tersimpan.");
    }
  }
  return (
    <>
      <div className="admin-toolbar">
        <input
          aria-label="Pencarian record"
          placeholder="Cari nama atau judul"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <button className="btn secondary" onClick={() => exportData("xlsx")}>
          Excel
        </button>
        <button className="btn secondary" onClick={() => exportData("pdf")}>
          PDF
        </button>
        {module === "anggota" && <ImportDialog kind="anggota" role={role} />}
        <button
          className="btn primary"
          onClick={() => setDraft({ id: crypto.randomUUID(), fields: {} })}
        >
          <Plus size={16} />
          Tambah
        </button>
      </div>
      {rows.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice((page - 1) * 6, page * 6).map((row) => (
                <tr key={row.id}>
                  {columns.map((c) => (
                    <td key={c.key}>{row.fields[c.key] || "—"}</td>
                  ))}
                  <td>
                    <div className="table-actions">
                      <button
                        className="icon-btn"
                        aria-label={"Edit " + (row.fields.nama || row.fields.judul)}
                        onClick={() => setDraft(structuredClone(row))}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={"Arsipkan " + (row.fields.nama || row.fields.judul)}
                        onClick={() => setArchive(row)}
                      >
                        <Archive size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="Belum ada record" description="Tambah data atau ubah pencarian." />
      )}
      <Pagination page={page} total={rows.length} onChange={setPage} />
      <Modal
        open={!!draft}
        title={moduleInfo[module].title + " / editor"}
        onClose={() => setDraft(null)}
      >
        {draft && (
          <form className="form-main" onSubmit={save}>
            <div className="form-grid">
              {defs.map((def) =>
                def.key === "isi" || def.key === "deskripsi" || def.key === "ringkasan" ? (
                  <div key={def.key} className="full">
                    <Textarea
                      label={def.label}
                      value={draft.fields[def.key] || ""}
                      onChange={(v) =>
                        setDraft({
                          ...draft,
                          fields: { ...draft.fields, [def.key]: v },
                        })
                      }
                    />
                  </div>
                ) : def.options ? (
                  <Select
                    key={def.key}
                    label={def.label}
                    options={def.options}
                    required
                    value={draft.fields[def.key] || ""}
                    onChange={(v) =>
                      setDraft({
                        ...draft,
                        fields: { ...draft.fields, [def.key]: v },
                      })
                    }
                  />
                ) : (
                  <Field
                    key={def.key}
                    label={def.label}
                    type={def.type || "text"}
                    required
                    value={draft.fields[def.key] || ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        fields: { ...draft.fields, [def.key]: e.target.value },
                      })
                    }
                  />
                ),
              )}
            </div>
            {module === "pengguna" && (
              <Notice>
                Akun contoh dibuat untuk review izin. Password awal, pergantian wajib, dan pemulihan
                akun diterapkan pada backend.
              </Notice>
            )}
            <div className="button-row">
              <button className="btn primary">Simpan perubahan</button>
              <button className="btn secondary" type="button" onClick={() => setDraft(null)}>
                Batalkan
              </button>
            </div>
          </form>
        )}
      </Modal>
      <Modal open={!!archive} title="Arsipkan record?" onClose={() => setArchive(null)}>
        <p>Record dapat dipulihkan oleh Super User dari modul arsip.</p>
        <div className="button-row">
          <button
            className="btn primary"
            onClick={() => {
              if (archive)
                updateStore(
                  (d) => {
                    const all = rowsFor(module, d);
                    all.find((r) => r.id === archive.id)!.archived = true;
                    d.records[module] = all;
                  },
                  "Mengarsipkan " + module,
                  archive?.id,
                  role,
                );
              setArchive(null);
              toast("Record diarsipkan.");
            }}
          >
            Arsipkan
          </button>
          <button className="btn secondary" onClick={() => setArchive(null)}>
            Batalkan
          </button>
        </div>
      </Modal>
    </>
  );
}
function Inventory({ role }: { role: Role }) {
  const state = useDemo();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Equipment | null>(null);
  const rows = state.equipment.filter(
    (e) => !e.archived && e.name.toLowerCase().includes(search.toLowerCase()),
  );
  const newItem = (): Equipment => ({
    id: crypto.randomUUID(),
    code: "",
    name: "",
    category: "Gunung Hutan",
    brand: "",
    total: 1,
    fit: 1,
    condition: "Baik",
    location: "",
    available: true,
    maxDays: 7,
    maxQuantity: 1,
    notes: "",
  });
  return (
    <>
      <div className="admin-toolbar">
        <input
          aria-label="Cari alat"
          placeholder="Nama atau kategori alat"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn primary" onClick={() => setDraft(newItem())}>
          <Plus size={16} />
          Tambah alat
        </button>
        <ImportDialog kind="inventaris" role={role} />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kode</th>
              <th>Alat</th>
              <th>Total / layak</th>
              <th>Kondisi</th>
              <th>Publik</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((eq) => (
              <tr key={eq.id}>
                <td>{eq.code}</td>
                <td>
                  {eq.name}
                  <br />
                  <small>{eq.category}</small>
                </td>
                <td>
                  {eq.total} / {eq.fit}
                </td>
                <td>{eq.condition}</td>
                <td>
                  <Badge>{eq.available ? "Tersedia" : "Tidak tersedia"}</Badge>
                </td>
                <td>
                  <button
                    className="icon-btn"
                    aria-label={"Edit " + eq.name}
                    onClick={() => setDraft(structuredClone(eq))}
                  >
                    <Pencil size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="role-notice">
        Pengunjung melihat tersedia/tidak tersedia. Angka stok hanya ditampilkan di admin.
      </p>
      <Modal open={!!draft} title="Detail inventaris" onClose={() => setDraft(null)}>
        {draft && (
          <form
            className="form-main"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.fit > draft.total) {
                toast("Jumlah layak tidak boleh melebihi jumlah total.");
                return;
              }
              if (state.equipment.some((eq) => eq.id !== draft.id && eq.code === draft.code)) {
                toast("Kode inventaris sudah digunakan.");
                return;
              }
              updateStore(
                (d) => {
                  const i = d.equipment.findIndex((eq) => eq.id === draft.id);
                  if (i >= 0) d.equipment[i] = draft;
                  else d.equipment.unshift(draft);
                },
                "Menyimpan inventaris",
                draft.code,
                role,
              );
              setDraft(null);
              toast("Inventaris disimpan.");
            }}
          >
            <div className="form-grid">
              {[
                ["code", "Kode inventaris"],
                ["name", "Nama alat"],
                ["brand", "Merek"],
                ["location", "Lokasi penyimpanan"],
                ["typeColor", "Tipe / warna"],
                ["source", "Sumber"],
                ["yearEntered", "Tahun masuk"],
                ["photo", "URL foto"],
              ].map(([key, label]) => (
                <Field
                  key={key}
                  label={label}
                  required={["code", "name", "brand", "location"].includes(key)}
                  value={String(draft[key as keyof Equipment] ?? "")}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              ))}
              <Select
                label="Kategori"
                options={["Gunung Hutan", "Rock Climbing", "Caving", "Rafting", "Lainnya"]}
                value={draft.category}
                onChange={(v) => setDraft({ ...draft, category: v })}
              />
              <Select
                label="Kondisi"
                options={[...conditions]}
                value={draft.condition}
                onChange={(v) => setDraft({ ...draft, condition: v as Equipment["condition"] })}
              />
              {[
                ["total", "Jumlah total"],
                ["fit", "Jumlah layak"],
                ["maxDays", "Batas durasi (hari)"],
                ["maxQuantity", "Batas jumlah"],
              ].map(([key, label]) => (
                <Field
                  key={key}
                  label={label}
                  type="number"
                  min={key === "total" || key === "fit" ? 0 : 1}
                  required
                  value={Number(draft[key as keyof Equipment])}
                  onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
                />
              ))}
            </div>
            <Textarea
              label="Catatan"
              value={draft.notes}
              onChange={(v) => setDraft({ ...draft, notes: v })}
            />
            <label className="consent">
              <input
                type="checkbox"
                checked={draft.available}
                onChange={(e) => setDraft({ ...draft, available: e.target.checked })}
              />
              Tampilkan sebagai tersedia untuk publik
            </label>
            <div className="button-row">
              <button className="btn primary">Simpan alat</button>
              <button type="button" className="btn secondary" onClick={() => setDraft(null)}>
                Batalkan
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
function Loans({ role }: { role: Role }) {
  const state = useDemo();
  const toast = useToast();
  const [filter, setFilter] = useState("Semua status");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const rows = state.loans.filter(
    (l) =>
      !l.archived &&
      (filter === "Semua status" || l.status === filter) &&
      (l.code + " " + l.institution).toLowerCase().includes(search.toLowerCase()),
  );
  const loan = state.loans.find((l) => l.id === selected);
  return (
    <>
      <div className="admin-toolbar">
        <input
          aria-label="Cari peminjaman"
          placeholder="Kode atau lembaga"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filter status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {[
            "Semua status",
            "Diajukan",
            "Disetujui",
            "Dipinjam",
            "Menunggu Verifikasi Pengembalian",
            "Terlambat",
            "Dikembalikan",
            "Ditolak",
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button
          className="btn secondary"
          onClick={() => {
            exportRows(
              "Peminjaman",
              rows.map((l) => ({
                kode: l.code,
                lembaga: l.institution,
                status: l.status,
                mulai: l.start,
                kembali: l.end,
              })),
              "xlsx",
            )
              .then(() => updateStore(() => {}, "Ekspor peminjaman", "peminjaman", role))
              .catch(() => toast("Gagal membuat ekspor."));
          }}
        >
          Ekspor Excel
        </button>
      </div>
      {rows.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kode / lembaga</th>
                <th>Jadwal</th>
                <th>Status</th>
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
                    {date(l.start)}
                    <br />
                    {date(l.end)}
                  </td>
                  <td>
                    <Badge>{l.status}</Badge>
                  </td>
                  <td>
                    <button className="btn secondary" onClick={() => setSelected(l.id)}>
                      Tinjau
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="Tidak ada pengajuan pada filter ini"
          description="Ubah pencarian atau status."
        />
      )}
      <Modal
        open={!!loan}
        title={"Pengajuan " + (loan?.code || "")}
        onClose={() => setSelected("")}
      >
        {loan && (
          <LoanReview
            key={loan.id + "-" + loan.status}
            loan={loan}
            role={role}
            close={() => setSelected("")}
          />
        )}
      </Modal>
    </>
  );
}
function LoanReview({ loan, role, close }: { loan: Loan; role: Role; close: () => void }) {
  const state = useDemo();
  const toast = useToast();
  const [draft, setDraft] = useState({
    ...structuredClone(loan),
    items: loan.items.map((i) => ({
      ...i,
      approved: loan.status === "Diajukan" ? i.requested : i.approved,
    })),
  });
  const [error, setError] = useState("");
  const returns = ["Menunggu Verifikasi Pengembalian", "Terlambat"].includes(loan.status);
  function save(status: Loan["status"]) {
    setError("");
    if (status === "Ditolak" && !draft.notes.trim()) {
      setError("Tuliskan alasan penolakan.");
      return;
    }
    if (status === "Disetujui") {
      if (!draft.items.some((i) => i.approved > 0)) {
        setError("Setujui sedikitnya satu alat.");
        return;
      }
      for (const item of draft.items) {
        if (item.approved < 0 || item.approved > item.requested) {
          setError("Jumlah disetujui harus antara 0 dan jumlah diminta.");
          return;
        }
        if (item.approved !== item.requested && !item.reason.trim()) {
          setError("Tuliskan alasan penyesuaian jumlah.");
          return;
        }
        const eq = state.equipment.find((e) => e.id === item.equipmentId)!;
        const reserved = state.loans
          .filter(
            (l) =>
              l.id !== loan.id &&
              !l.archived &&
              ["Disetujui", "Dipinjam", "Terlambat", "Menunggu Verifikasi Pengembalian"].includes(
                l.status,
              ) &&
              l.start <= loan.end &&
              l.end >= loan.start,
          )
          .reduce(
            (sum, l) => sum + (l.items.find((i) => i.equipmentId === eq.id)?.approved || 0),
            0,
          );
        if (item.approved > eq.fit - reserved) {
          setError("Jumlah " + eq.name + " melebihi stok layak pada jadwal tersebut.");
          return;
        }
      }
    }
    if (!canTransition(loan.status, status)) {
      setError("Transisi status tidak tersedia.");
      return;
    }
    updateStore(
      (d) => {
        const next = {
          ...draft,
          status,
          collateralStatus:
            status === "Dikembalikan" ? ("Dikembalikan" as const) : draft.collateralStatus,
          history: [
            ...loan.history,
            {
              status,
              at: new Date().toISOString(),
              note: draft.notes || "Status diperbarui oleh inventaris.",
            },
          ],
        };
        d.loans[d.loans.findIndex((l) => l.id === loan.id)] = next;
      },
      "Mengubah status " + status,
      loan.code,
      role,
      draft.notes,
    );
    toast("Pengajuan diperbarui.");
    close();
  }
  return (
    <div className="stack">
      <Badge>{loan.status}</Badge>
      <dl className="summary-list">
        {[
          ["Lembaga", loan.institution],
          ["PIC", loan.pic],
          ["Telepon", loan.phone],
          ["Jaminan", loan.collateral],
          ["Ambil", date(loan.start)],
          ["Kembali", date(loan.end)],
        ].map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Alat</th>
              <th>Diminta</th>
              <th>{returns ? "Kondisi kembali" : "Disetujui"}</th>
              <th>Alasan / kondisi keluar</th>
            </tr>
          </thead>
          <tbody>
            {draft.items.map((i, index) => (
              <tr key={i.equipmentId}>
                <td>{state.equipment.find((e) => e.id === i.equipmentId)?.name}</td>
                <td>{i.requested}</td>
                <td>
                  {returns ? (
                    <select
                      aria-label={"Kondisi " + i.equipmentId}
                      value={i.returnCondition}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          items: draft.items.map((j, n) =>
                            n === index
                              ? {
                                  ...j,
                                  returnCondition: e.target.value as Equipment["condition"],
                                }
                              : j,
                          ),
                        })
                      }
                    >
                      {conditions.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      aria-label={"Disetujui " + i.equipmentId}
                      type="number"
                      min={0}
                      max={i.requested}
                      value={i.approved}
                      disabled={loan.status !== "Diajukan"}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          items: draft.items.map((j, n) =>
                            n === index ? { ...j, approved: Number(e.target.value) } : j,
                          ),
                        })
                      }
                    />
                  )}
                </td>
                <td>
                  <input
                    aria-label={"Alasan " + i.equipmentId}
                    value={i.reason}
                    placeholder="Alasan penyesuaian"
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        items: draft.items.map((j, n) =>
                          n === index ? { ...j, reason: e.target.value } : j,
                        ),
                      })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Textarea
        label="Catatan / alasan perubahan"
        value={draft.notes}
        onChange={(v) => setDraft({ ...draft, notes: v })}
      />
      {loan.attachments.length > 0 && (
        <div>
          <h3>Bukti pengambilan privat</h3>
          <div className="attachment-list">
            {loan.attachments.map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
        </div>
      )}
      {returns && (
        <>
          <Notice>
            Denda keterlambatan hari ini:{" "}
            {money(latePenalty(loan.end, new Date().toISOString().slice(0, 10)))}
          </Notice>
          <div className="form-grid">
            <Field
              label="Nominal denda"
              type="number"
              min={0}
              value={draft.penalty}
              onChange={(e) => setDraft({ ...draft, penalty: Number(e.target.value) })}
            />
            <Select
              label="Status denda"
              options={["Tidak Ada", "Belum Lunas", "Lunas"]}
              value={draft.penaltyStatus}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  penaltyStatus: v as Loan["penaltyStatus"],
                })
              }
            />
          </div>
        </>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="button-row">
        {loan.status === "Diajukan" ? (
          <>
            <button className="btn primary" onClick={() => save("Disetujui")}>
              Setujui pengajuan
            </button>
            <button className="btn secondary" onClick={() => save("Ditolak")}>
              Tolak pengajuan
            </button>
          </>
        ) : returns ? (
          <button className="btn primary" onClick={() => save("Dikembalikan")}>
            Selesaikan pengembalian
          </button>
        ) : loan.status === "Dipinjam" ? (
          <button className="btn secondary" onClick={() => save("Terlambat")}>
            Tandai terlambat
          </button>
        ) : null}
        {!["Diajukan", "Ditolak"].includes(loan.status) && (
          <button
            className="btn secondary"
            onClick={() => invoicePdf(loan, state).catch(() => toast("Gagal membuat invoice."))}
          >
            Unduh invoice
          </button>
        )}
      </div>
      <h3>Riwayat status</h3>
      {loan.history.map((h, i) => (
        <p key={i}>
          {h.status} / {date(h.at)}
          <br />
          {h.note}
        </p>
      ))}
    </div>
  );
}
function RecruitmentAdmin({ role }: { role: Role }) {
  const state = useDemo();
  const toast = useToast();
  const [period, setPeriod] = useState(state.settings.period);
  const [newPeriod, setNewPeriod] = useState("");
  const [selected, setSelected] = useState("");
  const edit = canEdit(role, "or");
  const rows = state.applicants.filter((a) => !a.archived && a.period === period);
  const a = rows.find((a) => a.id === selected);
  return (
    <>
      <div className="admin-panel recruitment-controls">
        <h2>{state.settings.period}</h2>
        <Badge>{state.settings.recruitmentActive ? "Aktif" : "Ditutup"}</Badge>
        {edit && (
          <div className="recruitment-actions">
            <div className="button-row">
              <button
                className="btn primary"
                onClick={() =>
                  updateStore(
                    (d) => {
                      d.settings.recruitmentActive = !d.settings.recruitmentActive;
                    },
                    state.settings.recruitmentActive ? "Menutup OR" : "Melanjutkan periode OR",
                    state.settings.period,
                    role,
                  )
                }
              >
                {state.settings.recruitmentActive ? "Tutup periode" : "Lanjutkan periode"}
              </button>
            </div>
            <div className="recruitment-new-year">
              <h3>Periode tahunan baru</h3>
              <Field
                label="Tahun periode"
                type="number"
                min={2004}
                max={9999}
                placeholder="2027"
                value={newPeriod}
                onChange={(e) => setNewPeriod(e.target.value)}
              />
              <button
                className="btn secondary"
                disabled={!newPeriod.trim()}
                onClick={() => {
                  const label = annualPeriod(newPeriod);
                  if (!label) {
                    toast("Masukkan tahun empat digit, mulai 2004.");
                    return;
                  }
                  if (state.settings.periods.includes(label)) {
                    toast("Periode tahun tersebut sudah ada. Pilih dari filter periode.");
                    return;
                  }
                  updateStore(
                    (d) => {
                      d.settings.period = label;
                      d.settings.periods.unshift(label);
                      d.settings.recruitmentActive = true;
                    },
                    "Membuka periode OR",
                    label,
                    role,
                  );
                  setPeriod(label || "");
                  setNewPeriod("");
                }}
              >
                Buka periode tahunan
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="admin-toolbar recruitment-toolbar">
        <select
          aria-label="Filter periode OR"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          {state.settings.periods.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <button
          className="btn secondary"
          onClick={() =>
            exportRows("Pendaftar OR", rows.map(applicantExportRow), "xlsx")
              .then(() => updateStore(() => {}, "Ekspor OR Excel", period, role))
              .catch(() => toast("Ekspor gagal."))
          }
        >
          Ekspor Excel
        </button>
        <button
          className="btn secondary"
          onClick={() =>
            exportRows("Pendaftar OR", rows.map(applicantExportRow), "pdf")
              .then(() => updateStore(() => {}, "Ekspor OR PDF", period, role))
              .catch(() => toast("Ekspor gagal."))
          }
        >
          Ekspor PDF
        </button>
      </div>
      {rows.length ? (
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
              {rows.map((a) => (
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
                    <button className="btn secondary" onClick={() => setSelected(a.id)}>
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
          description="Pilih periode lain atau coba formulir OR publik."
        />
      )}
      <Modal open={!!a} title={"Pendaftar " + (a?.code || "")} onClose={() => setSelected("")}>
        {a && (
          <>
            <dl className="summary-list">
              {Object.entries(a.fields).map(([k, v]) => (
                <div key={k}>
                  <dt>{k.replace(/_/g, " ")}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <p className="role-notice">Pas foto: {a.photoName}</p>
            <button
              className="btn primary"
              onClick={() => applicantPdf(a).catch(() => toast("Gagal membuat formulir."))}
            >
              Unduh formulir PDF
            </button>
          </>
        )}
      </Modal>
    </>
  );
}
function SettingsAdmin({ role }: { role: Role }) {
  const state = useDemo();
  const toast = useToast();
  const [s, setS] = useState(state.settings);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <form
        className="admin-panel form-main"
        onSubmit={(e) => {
          e.preventDefault();
          updateStore(
            (d) => {
              d.settings = {
                ...d.settings,
                email: s.email,
                whatsapp: s.whatsapp,
                address: s.address,
                instagram: s.instagram,
                tiktok: s.tiktok,
                youtube: s.youtube,
                map: s.map,
                recruitmentActive: s.recruitmentActive,
              };
            },
            "Mengubah pengaturan",
            "pengaturan",
            role,
          );
          toast("Pengaturan disimpan.");
        }}
      >
        <h2>Kontak publik</h2>
        <div className="form-grid">
          {[
            ["email", "Email organisasi"],
            ["whatsapp", "WhatsApp (opsional)"],
            ["address", "Alamat"],
            ["instagram", "Instagram"],
            ["tiktok", "TikTok"],
            ["youtube", "YouTube"],
            ["map", "Tautan peta"],
          ].map(([key, label]) => (
            <Field
              key={key}
              label={label}
              type={key === "email" ? "email" : key === "campaignEnd" ? "date" : "text"}
              value={String(s[key as keyof typeof s])}
              onChange={(e) => setS({ ...s, [key]: e.target.value })}
            />
          ))}
        </div>
        <label className="toggle-setting">
          Open Recruitment aktif
          <input
            type="checkbox"
            checked={s.recruitmentActive}
            onChange={(e) => setS({ ...s, recruitmentActive: e.target.checked })}
          />
        </label>
        <div className="button-row">
          <button className="btn primary">Simpan pengaturan</button>
        </div>
      </form>
      <div className="admin-panel">
        <h2>Data preview</h2>
        <p>Kembalikan seluruh data lokal ke contoh awal.</p>
        <button
          className="btn secondary"
          style={{ marginTop: 20 }}
          onClick={() => setConfirm(true)}
        >
          Reset data contoh
        </button>
      </div>
      <Modal open={confirm} title="Reset data contoh?" onClose={() => setConfirm(false)}>
        <p>Semua perubahan pada browser ini akan diganti dengan data contoh awal.</p>
        <div className="button-row">
          <button
            className="btn primary"
            onClick={() => {
              resetStore();
              setConfirm(false);
              toast("Data contoh dikembalikan.");
            }}
          >
            Reset data contoh
          </button>
          <button className="btn secondary" onClick={() => setConfirm(false)}>
            Batalkan
          </button>
        </div>
      </Modal>
    </>
  );
}
function Archives({ role }: { role: Role }) {
  const state = useDemo();
  const [selected, setSelected] = useState<{
    module: string;
    id: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const items = Object.keys(state.records).flatMap((module) =>
    rowsFor(module, state)
      .filter((r) => r.archived)
      .map((r) => ({
        module,
        id: r.id,
        label: r.fields.nama || r.fields.judul || r.id,
      })),
  );
  return (
    <>
      {items.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Record</th>
                <th>Jenis</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.label}</td>
                  <td>{item.module}</td>
                  <td>
                    <div className="button-row">
                      <button
                        className="btn secondary"
                        onClick={() =>
                          updateStore(
                            (d) => {
                              d.records[item.module].find((r) => r.id === item.id)!.archived =
                                false;
                            },
                            "Memulihkan record",
                            item.id,
                            role,
                          )
                        }
                      >
                        Pulihkan
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={"Hapus permanen " + item.label}
                        onClick={() => {
                          setSelected(item);
                          setReason("");
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="Arsip masih kosong"
          description="Record yang diarsipkan akan ditampilkan di sini."
        />
      )}
      <Modal open={!!selected} title="Hapus permanen?" onClose={() => setSelected(null)}>
        <form
          className="form-main"
          onSubmit={(e) => {
            e.preventDefault();
            if (!selected || !reason.trim()) return;
            updateStore(
              (d) => {
                d.records[selected.module] = d.records[selected.module].filter(
                  (r) => r.id !== selected.id,
                );
              },
              "Menghapus permanen",
              selected.id,
              role,
              reason,
            );
            setSelected(null);
          }}
        >
          <Notice tone="error">
            Record tidak bisa dipulihkan setelah penghapusan permanen. Isi alasan untuk audit.
          </Notice>
          <Textarea label="Alasan penghapusan" required value={reason} onChange={setReason} />
          <div className="button-row">
            <button className="btn primary">Hapus permanen</button>
            <button type="button" className="btn secondary" onClick={() => setSelected(null)}>
              Batalkan
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
