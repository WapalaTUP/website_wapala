# Catatan Perubahan — untuk Agent Utama

File ini mencatat SEMUA perubahan yang dibuat agent (opencode) pada repo `Dev_Website`.
Format: tanggal, status (diagnosis/perbaikan), file yang disentuh, dan alasannya.

---

## 2026-10-14

### Perubahan 1 — Template environment: cabut sisa Turnstile
- File: `.env.example`, `.env.production.example`
- Menghapus blok `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` + komentarnya.
- Alasan: perintah user (2) — cabut Cloudflare Turnstile TOTAL, termasuk konfigurasi.

### Perubahan 2 — Hapus dead code Turnstile
- File dihapus: `src/server/security/public-challenge.ts` (widget/Siteverify helper, tidak dipanggil di mana pun — diverifikasi `rg`).
- File: `scripts/backend-dev.ts` — menghapus path dotenv `.local/turnstile.env`.
- Alasan: perintah user (2); kode mati dengan fail-closed 503 berpotensi disalahkan sebagai penyebab gagal submit.

### Perubahan 3 — Dokumentasi disinkronkan
- `docs/backend-local-setup.md`, `docs/deployment-ubuntu.md`: paragraf "Turnstile wajib / fail closed" diganti penjelasan proteksi aktif (CSRF same-origin, cookie form-owner HttpOnly, throttle persisten).
- `docs/release-execution-ledger.md` baris 8: menghapus klaim "Turnstile verification", menambah catatan pencabutan total.
- Sisa referensi Turnstile di repo: hanya asersi negatif `tests/backend/security.test.ts:7` (penjaga agar tidak kembali) dan catatan historis ledger.

### Verifikasi setelah perubahan
- `npm run typecheck` — lulus (exit 0).
- `npm run lint` — lulus (0 error, 8 warning `_obsoleteVerifier` yang sudah ada sebelumnya).
- `npm test` — 89/89 lulus; `npm run test:backend` — 37/37 lulus.

### Infrastruktur Git (perintah user: upload ke GitHub)
- Dibuat repo git BARU di dalam `Dev_Website` (`git init -b master`) — terpisah dari repo induk `WAPALA` yang memuat `Src/` dokumen privat (tidak boleh ke GitHub).
- `.gitignore` sudah menutup `.env*` (kecuali example), `.local/`, `node_modules/`, `.next/`, `src/generated/`, `output/`.
- Scan secret: tidak ada secret hardcoded di `src/`; template env hanya placeholder.
- Remote: `https://github.com/hulwanulazka-companion/wapala_dev.git` (repo kosong, terverifikasi `git ls-remote`).
- Commit pertama `715342c` — 454 file, terverifikasi 0 `node_modules`, 0 `.env` asli.
- Push awal gagal 403 (kredensial tersimpan milik akun `HulwanulAzkaP`, repo milik `hulwanulazka-companion`); SSH key lokal juga belum terdaftar di GitHub.
- User mengundang `HulwanulAzkaP` sebagai collaborator → push ulang SUKSES: `master` → `origin/master` (tracking aktif).
- Isi commit: kode sumber audited + konfigurasi + migrasi Prisma + docs + deploy; TANPA node_modules (user clone lalu `npm ci` + `db:generate` + `db:migrate` + `build`).

### Perubahan 4 — README ditulis ulang (perintah user)
- `README.md` lama adalah catatan checkpoint UI yang sudah kedaluwarsa ("backend belum dimulai") — dipindahkan apa adanya ke `agent_readme.md` baru, diberi header arsip riwayat agent + peringatan info basi.
- `README.md` baru ditulis sebagai dokumentasi proyek: fitur situs publik & portal admin (divisi alam: Gunung & Hutan, Rock Climbing, Caving, Rafting), tabel teknologi, quickstart development, bootstrap Super User, perintah verifikasi, deployment (pointer ke `docs/` + `deploy/`), ringkasan keamanan formulir publik (tanpa verifikasi pihak ketiga), dan struktur folder.
- Fakta diambil dari kode (navigasi `shell.tsx`, divisi `lib/content.ts`, skrip `package.json`); teks profil/vision tidak di-hard-code karena tersimpan di database.

### Perubahan 6 — Logo konsisten di `/wapala` dan `/admin` (permintaan user)
**Penyebab inkonsistensi:** komponen `Logo` (satu komponen sama untuk semua halaman) membaca `settings.logoUrl` dari `DataProvider`. Layout publik membungkus halaman dengan `publicState()` (memuat `logoUrl`), tetapi `/wapala` (login) dan `/admin` TIDAK punya provider → `Logo` menerima state kosong → jatuh ke placeholder "W".

**Perbaikan (pola sama dengan layout publik):**
- `src/server/public-data.ts` — helper baru `brandLogoUrl()`: baca `config.logoUrl` dari `SiteSettings` id=1 (sumber sama persis dengan website publik).
- `src/app/wapala/layout.tsx` (baru) dan `src/app/admin/layout.tsx` (baru) — layout server yang membungkus children dengan `DataProvider` berisi `settings.logoUrl`.
- `src/components/backend/administration.tsx` — `BackendSettings` kini memanggil `router.refresh()` setelah simpan, supaya logo baru langsung terlihat di sidebar admin tanpa reload manual.

**Perbaikan tooling typecheck (muncul saat verifikasi):**
- `next-env.d.ts` — menghapus dua import basi ke `.next-http-test/dev/types/` (sisa build uji integrasi jam 5:28) yang mendeklarasikan global `LayoutProps` dengan batasan `"/"` (pralayout), membuat `tsc` gagal di `.next/dev/types/validator.ts(30)`.
- Menghapus `.next/types/` basi (hasil build pralayout, constraint sama) — dibuat ulang otomatis oleh `next build`.
- Catatan: bila `test:backend:integration` dijalankan, Next dapat menulis ulang `next-env.d.ts` mengarah ke `.next-http-test`; tipe itu diregenerasi per-run sehingga tetap konsisten.

**Verifikasi:**
- typecheck 0 error; lint 0 error (8 warning lama); `npm test` lulus; `npm run test:backend` lulus.
- SSR HTTP: `/wapala` dan `/` sama-sama memuat logo DB `fcf404c3-43b9-4c18-b7e8-97f1a5da458a` (sumber identik); `/admin` tanpa sesi tetap 307 ke login.
- Catatan verifikasi visual `/admin` (setelah login) menjadi konfirmasi UAT user.

### Status diagnosis bug submit peminjaman (SELESAI — akar masalah ditemukan & diperbaiki)

**Akar masalah:** migrasi `202610140002_public_forms` (membuat tabel `PublicFormReceipt` + `ApplicantRevision`) belum diterapkan ke database dev lokal. DB hanya sampai `202610130009_event_replay_fences`. Setiap submit memanggil `publicFormReceipt.findUnique` di transaksi awal → Prisma error "relation does not exist" → bukan `DomainError` → catch-all `route()` → **500 INTERNAL ~13ms** (12x di log). Admin/katalog/context tidak menyentuh tabel itu sehingga tampak normal; test lulus karena memakai schema per-run yang selalu di-migrate.

**Tindakan:**
1. Terapkan migrasi: `npm run db:migrate` → `202610140002_public_forms` sukses (murni additive, data aman).
2. Verifikasi end-to-end via HTTP (persis jalur browser: cookie preauth + form-owner + header CSRF + Origin): `POST /api/public/forms/submit` → **200**, kode `WPL6P54L`, status `requested`; baris terkonfirmasi di DB (Loan + PublicFormReceipt).
   - Catatan: uji pertama sempat 400 INVALID_INPUT — artefak alat uji (BOM UTF-8 PowerShell membuat JSON.parse gagal), BUKAN bug produk.
   - Record uji sengaja dibiarkan: loan `WPL6P54L` institution "UJI KONEKSI (hapus)" — bukti di `/admin/peminjaman`, silakan dihapus/ditolak dari admin.
3. Perubahan 5: `src/server/http/auth-handler.ts` — log INTERNAL kini menyertakan `message` + ringkasan `stack` (sebelumnya error asli ditelan, penyebab diagnosis kemarin lambat). Typecheck + lint lulus.

**Belum berubah (fitur):** tidak ada perubahan logika fitur pada jalur submit.

---

