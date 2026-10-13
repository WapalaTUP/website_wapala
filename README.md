# Website WAPALA

Website resmi WAPALA — organisasi kemahasiswaan pecinta alam Telkom University dengan empat divisi: Gunung & Hutan, Rock Climbing, Caving, dan Rafting. Website menyediakan profil organisasi, publikasi kegiatan, arsip dokumentasi, serta layanan daring untuk publik yang seluruh datanya dikelola melalui portal admin.

## Fitur

**Situs publik**

- Beranda dengan galeri foto terbaru, profil angkatan, divisi, dan lokasi sekretariat.
- Profil organisasi (sejarah, visi, misi, 21 angkatan) dan halaman per divisi.
- Berita kegiatan, pengumuman, galeri foto, dan perpustakaan buku publik (pembaca PDF dua halaman dan EPUB langsung di browser).
- **Peminjaman alat**: katalog alat dari database, pengajuan periode mulai–selesai, dan pelacakan status dengan kode pengajuan + nomor telepon.
- **Open Recruitment (OR)**: formulir dinamis per periode, unggah foto, revisi mandiri oleh peserta.
- **Donasi**: kampanye aktif, unggah bukti transfer, verifikasi admin.
- **Event**: pendaftaran dengan formulir dinamis, konfirmasi, dan unggah berkas.

**Portal admin** (`/wapala` untuk login, kemudian `/admin`)

- Dashboard ringkas, inventaris alat dengan ketersediaan versi (availability-only PATCH), peminjaman dengan alur status (diajukan → disetujui → dipinjam → dikembalikan) termasuk keterlambatan & denda.
- Rekrutmen per periode dengan ekspor, donasi & kampanye terpisah, event dengan pembuat formulir dan ekspor jawaban.
- Manajemen anggota (impor CSV), pengguna & peran, pengaturan branding, arsip dengan pemulihan, jejak audit.

## Teknologi

| Bagian | Teknologi |
| --- | --- |
| Framework | Next.js 16.4 (App Router, Turbopack), React 19, TypeScript |
| Database | PostgreSQL + Prisma 7 (adapter `@prisma/adapter-pg`) |
| Validasi | Zod 4 |
| Gaya & UI | CSS murni + CSS Modules global, ikon `lucide-react`, font `@fontsource` |
| Media | `sharp` (pemrosesan gambar), pembaca PDF/EPUB, penyimpanan privat |
| Keamanan | Argon2 (password), cookie sesi HttpOnly, CSRF same-origin, throttle persisten per IP/pemilik formulir, pemindaian malware ClamAV fail-closed |
| Email | Outbox + worker (`nodemailer`), mode `sink` di development, SMTP di produksi |

## Menjalankan pengembangan

Prasyarat: Node.js 24, PostgreSQL 14+ berjalan lokal.

```sh
npm ci
cp .env.example .env          # isi DATABASE_URL, TEST_DATABASE_URL, SECURITY_KEY
npm run db:generate           # generate Prisma client
npm run db:migrate            # terapkan migrasi
npm run db:seed               # data awal (tanpa akun demo)
npm run dev                   # http://127.0.0.1:3000
```

Bootstrap Super User setelah migrasi/seed:

```sh
npm run auth:bootstrap-token  # token tampil di terminal, berlaku 30 menit
```

Masukkan token di `/wapala`, lalu buat password Super User. Login tidak memiliki password bawaan. Detail lengkap: `docs/backend-local-setup.md`.

## Verifikasi & build

```sh
npm run typecheck             # pemeriksaan TypeScript
npm run lint                  # ESLint
npm test                      # uji frontend/unit
npm run test:backend          # uji unit server (react-server)
npm run test:backend:integration  # butuh PostgreSQL nyata, schema per-run terisolasi
npm run build                 # build produksi
```

## Deployment produksi

Target produksi adalah Ubuntu native (tanpa Docker) dengan Nginx/TLS, systemd, PostgreSQL native, dan ClamAV untuk pemindaian unggahan yang fail-closed. Panduan lengkap tersedia di:

- `docs/deployment-ubuntu.md` — persiapan host, lingkungan, build & aktivasi.
- `deploy/` — unit systemd, timer, konfigurasi Nginx, wrapper ClamAV, skrip pemeriksaan rilis.
- `.env.production.example` — template lingkungan produksi (jangan pernah berisi kredensial asli).

## Keamanan formulir publik

Pengajuan publik (peminjaman, OR, donasi, event) dilindungi CSRF same-origin, cookie pemilik formulir HttpOnly, validasi ketat di server, rate limit persisten, batas ukuran/tipe berkas, dan pemindaian malware fail-closed. Tidak ada layanan verifikasi pihak ketiga pada formulir.

## Struktur singkat

```
src/app/            route App Router (publik, admin, API)
src/components/     komponen UI publik, admin, dan event
src/server/         domain logic, auth, media, email, keamanan
src/lib/            utilitas bersama
prisma/             skema, migrasi, seed
tests/              uji frontend, unit backend, dan integrasi
docs/               panduan setup, deployment, dan catatan kerja
deploy/             artefak deployment Ubuntu
scripts/            CLI operasional (worker email, overdue, backup, dst.)
```
