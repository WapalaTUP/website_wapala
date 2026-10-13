# Peta CodeGraph WAPALA

Checkpoint: 13 Oktober 2026. Sumber kebutuhan: `../../prd.md` dan revisi pengguna di percakapan ini. PRD asli tidak ditimpa; revisi eksplisit terbaru mengungguli bagian PRD yang berbeda. Peta ini mencatat keadaan kode, bukan bukti fitur production-ready.

## Checkpoint backend terbaru

Bagian peta frontend di bawah tetap menjelaskan jalur preview historis. Mode backend menggunakan sesi database, API dan domain server; tidak menggunakan `updateStore` sebagai otoritas.

| Area | Jalur backend sekarang | Batas yang masih tersisa |
| --- | --- | --- |
| Sesi, bootstrap, recovery email/SSH | `server/auth`, `api/auth`, `components/auth` | SMTP nyata/VPS belum diuji |
| Kampanye multi-rekening, poster dan QRIS | `domains/campaigns`, `api/admin/campaigns`, `backend/campaigns` | Form donasi publik/CAPTCHA belum terhubung |
| OR tahunan, anggota dan konten | `domains/recruitment`, `domains/records`, `backend/recruitment`, `backend/records` | Form publik, revisi dan ekspor belum selesai |
| Inventaris dan impor | `domains/inventory`, `backend/inventory`, `backend/import` | Impor paket seluruh Src belum dibuat |
| Pengguna dan reset kepengurusan | `auth/users`, `domains/management`, `backend/users`, `backend/management` | Tinjauan final operasi belum dilakukan |
| Peminjaman | `domains/loans`, `domains/stock`, API admin, `backend/loans` | UI admin terhubung; tracking publik, invoice dan pelunasan denda lanjutan belum selesai |
| Dashboard, pengaturan, audit dan arsip | `admin-summary`, `backend/dashboard`, `backend/administration`, `domains/archives` | Semua menu terhubung; arsip saat ini baca saja, ekspor/pemulihan/penghapusan belum selesai |
| Media | `server/media`, `api/admin/media`, `api/media`, `media/[id]` | Scanner wajib fail-closed; instalasi native belum diverifikasi lokal |
| Event dan formulir dinamis | `lib/event-form`, `domains/events`, `event-registrations`, `event-export`, `components/events`, API Event/admin | Frontend dan database terhubung; immutable revision, quota/replay, upload privat dan Excel tersedia. Native scanner tetap prasyarat upload; QA visual pengguna dan final review dicatat di `event-implementation-ledger.md` |
| Data publik dan galeri | `server/public-data`, `DataProvider`, `gallery` | Backend tanpa fallback album preview; profil dan pembaca buku masih perlu integrasi |
| Ubuntu native dan ZIP | Belum selesai | Paket source bersih dan paket impor privat harus terpisah |

Bukti detail dan batas pengujian: `docs/backend-operations-ledger.md`. Jangan menyamakan tes lulus dengan deployment sudah selesai.

## Ruang lingkup dan cara pakai

- CodeGraph CLI 1.6.2 dipasang terpisah di `C:/Users/raffi/.codex/tools/codegraph`, bukan dependency website.
- Akar indeks: `Dev_Website`; SQLite lokal berada di `.codegraph/`. Folder induk `Src` tidak masuk indeks.
- `codegraph.json` mengecualikan aset publik, output, dependency, build, dokumen biner, environment, dan skrip Figma lama. Pengecualian `Src/` tidak digunakan: pencocokan di Windows juga mengecualikan kode `src/`.
- Wrapper `scripts/codegraph.ps1` menonaktifkan telemetry dan update check hanya selama proses tersebut, lalu memulihkan environment pemanggil.
- MCP belum didaftarkan dan tidak ada watcher aktif yang diasumsikan. Untuk CLI, jalankan `sync` setelah perubahan kode sebelum query berikutnya.

Jalankan dari `Dev_Website`:

```powershell
pwsh -NoProfile -File scripts/codegraph.ps1 status
pwsh -NoProfile -File scripts/codegraph.ps1 sync
pwsh -NoProfile -File scripts/codegraph.ps1 query CampaignAdmin --limit 3 --json
pwsh -NoProfile -File scripts/codegraph.ps1 explore "CampaignAdmin campaign bank accounts and DonationForm" --max-files 2
```

Gunakan query spesifik dan batas hasil; baca sumber terkini sebelum edit. Perubahan konfigurasi pengecualian membutuhkan `index`, bukan sekadar mengasumsikan indeks ikut berubah. Gunakan `help <command>` untuk opsi yang tersedia. Jangan menjalankan installer MCP global atau mengindeks folder induk tanpa instruksi pengguna.

## Kebutuhan ke kode saat ini

| Kebutuhan | Titik masuk / model | Keadaan checkpoint |
|---|---|---|
| Navigasi satu header, Beranda, brand lengkap, tema, CTA kanan Kontak | `shell.tsx`, `Settings`, `polish.css` | Preview tersedia; OR/donasi masih mengikuti flag demo |
| Hero 10 foto terbaru + highlight manual, 5 detik, rasio asli | `HeroGallery`, utilitas `gallery.ts`, `live-albums.ts` | Preview tersedia; tanggal tak terverifikasi tidak ditebak |
| Galeri bawah 5 kategori berbeda, dua foto bertingkat | `CategoryGallery`, `getCategoryGalleryPhotos` | Preview tersedia |
| Jumbotron2 berbentuk di banner OR saja | `public-pages.tsx`, `polish.css` | Preview tersedia; bersyarat saat OR aktif |
| Profil, 21 angkatan, empat divisi, peta sekretariat | `content.ts`, `generations.tsx`, `public-pages.tsx` | Preview tersedia; data pribadi anggota tidak dipublikasikan |
| Buku dua halaman desktop, satu mobile | `BookReader`, `reader-pages.ts` | PDF preview tersedia; proteksi media server/EPUB masih tahap lanjutan |
| OR satu periode tahunan dan field contoh dokumen | `RecruitmentAdmin`, `Recruitment`, `periods.ts`, `recruitment-fields.ts` | Preview tersedia; kontrol periode/ekspor dirapikan |
| Inventaris dan peminjaman | `Inventory`, `Loans`, `LoanForm`, `LoanTracking`, `domain.ts` | Demo lokal; belum database/API produksi |
| Invoice A4 landscape, dua salinan, watermark, kop dan logo Tel-U | `Invoice`, `invoice-document.ts`, `exports.ts` | PDF contoh tersedia; generator produksi nanti di server |
| Anggota, pengguna, arsip, audit berbasis role | `Records`, `Archives`, `admin-role.ts`, `domain.ts`, `store.ts` | Preview lokal; bukan RBAC/session aman server |
| Kampanye dan verifikasi donasi | `CampaignAdmin`, `DonationForm`, `CampaignPages`, `campaigns.ts`, `preview-migration.ts` | Multi-kampanye, QRIS, poster terpisah, beberapa rekening/penerima, total terisolasi dan migrasi preview tersedia |
| Impor anggota/inventaris | `ImportDialog`, `import-data.ts`, `import-files.ts` | CSV/XLSX, template, pemetaan, validasi seluruh batch dan konfirmasi; tambah baru tanpa overwrite |
| Reset kepengurusan | `ManagementReset`, `management.ts` | Super User saja; arsip selesai/ditolak, kewajiban aktif dipertahankan; reset password hanya permintaan preview |
| Deployment pertama, impor Src, bootstrap /wapala, tanpa seed mock produksi | `docs/backend-handoff.md`, `Login`, `seed.ts` | Kebutuhan backend; belum diimplementasikan |

Jalur donasi saat ini: `CampaignAdmin` → `updateStore` → `campaigns` / `donations.campaignId` → `CampaignPages` / `DonationForm`; navigasi membaca `activeCampaigns`. Rekening tujuan disimpan dengan ID dan snapshot. Pengaturan tunggal lama dimigrasikan tanpa menghilangkan konfirmasi.

## Kebutuhan revisi dan status implementasi

Bagian berikut mencatat kebutuhan sumber. Preview telah diimplementasikan untuk kampanye/QRIS/bank/poster, impor, akun dan reset kepengurusan. Rincian implementasi ada di tabel di atas; persyaratan keamanan/penyimpanan/reset password server tetap menunggu backend. Verifikasi akhir: 38 tes, typecheck, lint dan build lulus. Pengguna melarang browser lanjutan; review tampilan berikutnya memakai screenshot pengguna.

### Multi-kampanye dan QRIS

- Beberapa kampanye independen: judul, keterangan tujuan/penerima, sampul, target, rekening, kolaborator, tanggal mulai/selesai, status, dan **unggah foto QRIS per kampanye**.
- Donasi harus terikat ke kampanye; total hanya menjumlah konfirmasi terverifikasi kampanye tersebut. Kampanye Marapi dan Banjir Demak adalah contoh pengguna, bukan pernyataan adanya penggalangan dana aktif.
- Admin menambah/mengedit/membuka/menutup masing-masing kampanye; publik memilih dari kampanye yang dibuka. Tidak menampilkan identitas donatur.
- Model kampanye/relasi konfirmasi dan migrasi pengaturan tunggal tersedia dalam preview; data lama dipertahankan.

### Impor Inventaris dan Anggota

- Sediakan aksi impor pada kedua menu. Izin mengikuti role: Inventaris untuk Logistik/Super User, Anggota untuk POH/Super User.
- Impor: CSV/XLSX, template, pemetaan kolom, pratinjau, validasi field/duplikasi, lalu konfirmasi. Konflik memblokir seluruh batch; tidak menimpa record lama.
- Jangan menjadikan dokumen sumber pribadi sebagai aset publik atau seed mock produksi. Import produksi harus idempotent dan tercatat dalam audit.

### Reset periode kepengurusan

- Menu hanya untuk Super User; backend tetap wajib memverifikasi izin, bukan sekadar menyembunyikan menu.
- Arsip peminjaman per kepengurusan tanpa menghapus riwayat. Penanganan peminjaman aktif/terlambat harus diputuskan sebelum reset agar barang yang masih keluar tidak dianggap tersedia.
- Pilihan per akun: pertahankan password atau ganti baru, termasuk tiga admin utama dan pengguna lain. Sediakan reset password Super User sebagai tindakan terpisah, bukan otomatis ikut reset massal.
- Tampilkan ringkasan dampak dan konfirmasi; perubahan password sungguhan harus di server, mencabut sesi terkait dan memakai alur kredensial sementara/wajib ganti sesuai PRD. Jangan memasukkan password nyata ke demo localStorage atau dokumen ini.

### Nama akun admin yang disepakati

| Identitas login | Role / tanggung jawab |
|---|---|
| `POH@wapala.org` | POH: anggota |
| `Logistik@wapala.org` | Inventaris: inventaris dan peminjaman |
| `Kerjasama@wapala.org` | Multimedia/Mulmed: konten, OR, kampanye/donasi |

Alamat tersebut adalah identitas login yang diminta, bukan izin untuk membuat mailbox/domain/email eksternal. Identitas Super User belum ditetapkan. Akun role bawaan preview telah diperbarui dengan migrasi yang mempertahankan akun kustom.

## Verifikasi preview dan kebutuhan server berikutnya

CodeGraph membantu memilih sumber dan dampak, tidak menggantikan test. Jalankan suite proyek, typecheck, lint, build, dan pengecekan browser sesuai risiko. Untuk multi-kampanye uji pemisahan total, status, QRIS dan migrasi; impor uji duplikasi/field salah/izin; reset uji arsip, peminjaman aktif, pilihan akun, akses Super User, dan pencabutan sesi di backend.
