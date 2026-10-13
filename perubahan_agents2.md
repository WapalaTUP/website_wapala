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

### Status diagnosis bug submit peminjaman (MASIH TERBUKA)
- Log dev: 12x `POST /api/public/forms/submit 500` `INTERNAL` — error asli ditelan catch-all `route()` (`src/server/http/auth-handler.ts:81-91`) tanpa stack, sehingga penyebab belum terlihat di log.
- Error `useRef is not defined` di log = keadaan lama; kini `public-transport.tsx` sudah benar dan halaman `/peminjaman` 200.
- Diagnosis lanjutan menyusul; BELUM ada perubahan pada jalur submit.

---

