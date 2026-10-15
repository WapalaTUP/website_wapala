# Website WAPALA

Website Wahana Pencinta Alam Telkom University Purwokerto, dibangun dengan
Next.js 16, React 19, TypeScript, PostgreSQL, dan Prisma 7. Halaman pengelola
ada di `/wapala`.

Panduan ini untuk deployment dari
[`WapalaTUP/website_wapala`](https://github.com/WapalaTUP/website_wapala) ke Vercel.
Branch produksi adalah `main`. Tidak perlu memasang Nginx, Docker, PostgreSQL
lokal, atau service systemd untuk menjalankan aplikasi di Vercel.

## Sebelum deploy

Login dan inisialisasi Super User sudah mendukung token dari environment.
Database tetap harus disiapkan dan dimigrasikan terlebih dahulu. Build Vercel
belum menjalankan migrasi, membuat akun, atau mengimpor data secara otomatis.

Ada bagian yang belum selesai untuk Vercel:

- Media masih memakai filesystem privat dan executable ClamAV. Kode belum
  membaca atau menulis file ke Vercel Blob. Membuat Blob store atau menambahkan
  token Blob saja tidak menghubungkannya ke aplikasi.
- Upload foto, logo, poster, QRIS, bukti transfer, dan dokumen belum dapat
  dianggap berfungsi di Vercel. Media lama juga perlu dipindahkan beserta
  adapter pembacaannya, bukan hanya disalin baris databasenya.
- Worker email, pengecekan keterlambatan peminjaman, dan pembersihan media belum
  mempunyai jadwal Vercel Cron atau worker terpisah.

Deployment dapat dipakai untuk pengujian halaman, database, dan login. Jangan
membuka seluruh layanan untuk pengguna umum sebelum storage, scanning, pekerjaan
terjadwal yang diperlukan, dan pengujian alur selesai. Status **Ready** di Vercel
hanya menyatakan deployment berhasil dibuat.

## Yang perlu disiapkan

1. Akun Vercel dengan akses ke repository GitHub WAPALA. Jika repository tidak
   muncul saat import, beri GitHub App Vercel akses melalui pengaturan organisasi
   `WapalaTUP`.
2. PostgreSQL cloud khusus aplikasi ini, misalnya Neon. Gunakan database baru
   atau database tujuan yang sudah disetujui. Jangan memakai koneksi database
   VPS yang masih melayani website lama.
3. Dua akun database: pemilik/migrator untuk perubahan struktur, dan runtime
   untuk aplikasi. Runtime bukan superuser, pemilik tabel, atau anggota role
   pemilik, dan tidak boleh membuat/menghapus tabel.
4. Node.js 24 dan Git pada perangkat operator untuk dependensi, migrasi, dan
   pemulihan akun. Perangkat ini tidak harus menjalankan website.
5. Origin HTTPS tujuan, misalnya `https://nama-project.vercel.app`. Domain
   sendiri bisa ditambahkan setelah deployment pertama.
6. Secret baru untuk `SECURITY_KEY` dan `INITIAL_SETUP_TOKEN`. Jangan mengambil
   password, secret, atau sesi dari deployment lain.

Resource Vercel/Neon milik akun lain tidak ikut ketika repository disalin.
Hubungkan resource pada project dan environment tujuan. Untuk pengaturan import,
lihat [panduan Git Vercel](https://vercel.com/docs/git).

## 1. Siapkan database

### Koneksi

Buat database khusus WAPALA. Contoh izin di bawah memakai schema `public` pada
database khusus tersebut, bukan database bersama aplikasi lain.

Gunakan endpoint PostgreSQL **direct/unpooled** untuk migrasi. Untuk runtime,
gunakan koneksi direct terlebih dahulu: adapter saat ini mengatur `search_path`
melalui opsi koneksi. Jangan mengganti ke transaction pooler sebelum perilaku
tersebut diuji dengan provider yang dipakai. Pool aplikasi dibatasi lima koneksi
per instance; beberapa instance Vercel tetap bisa membuka lebih banyak koneksi
secara keseluruhan.

Format URL runtime:

```text
postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=verify-full
```

Ganti bagian contoh dengan nilai provider. Password dengan karakter khusus
harus di-URL-encode. Validator aplikasi hanya menerima parameter `sslmode` dan
`schema`; parameter tambahan seperti `channel_binding` atau `options` ditolak.
Susun URL yang sesuai tanpa menurunkan verifikasi TLS. Jangan memakai
`sslmode=disable` untuk koneksi cloud.

### Migrasi pertama

Clone repository pada perangkat operator:

```sh
git clone https://github.com/WapalaTUP/website_wapala.git
cd website_wapala
npm ci
npm run db:generate
```

Buat file privat `.env.migrate` pada root checkout:

```dotenv
NODE_ENV=production
DATABASE_URL=ISI_URL_DIRECT_DENGAN_ROLE_MIGRATOR
```

Gunakan URL sebenarnya hanya pada file lokal tersebut. Jangan commit,
membagikannya, atau menempelkan URL ke perintah shell. Batasi akses file;
di Linux/macOS gunakan `chmod 600 .env.migrate`.

Jalankan dari root checkout:

```sh
node --env-file=.env.migrate node_modules/prisma/build/index.js migrate status
node --env-file=.env.migrate node_modules/prisma/build/index.js migrate deploy
```

`migrate status` dapat keluar dengan status nonzero ketika ada migrasi yang
belum diterapkan. Periksa laporannya sebelum melanjutkan. Seluruh migrasi harus
terpasang, termasuk `202610160002_environment_bootstrap_token`.

Prisma membaca `DATABASE_URL` untuk migrasi. Belum ada dukungan `DIRECT_URL`
atau `MIGRATION_DATABASE_URL` pada konfigurasi repository ini. Pastikan terminal
tidak membawa `DATABASE_URL` dari aplikasi lain: environment proses dapat
mengalahkan isi file `--env-file`.

Tidak perlu membuat akun lewat SQL atau menjalankan seed demo. Foundation
instalasi dibuat ketika alur token environment pertama diakses. Jangan memakai
`prisma db push`, `migrate reset`, atau menghapus tabel untuk instalasi produksi.

### Izin runtime

Buat akun runtime lewat fasilitas pengelolaan role provider, dengan password
baru dan tanpa keanggotaan role pemilik. Contoh berikut menganggap namanya
`wapala_app`. Jalankan sebagai pemilik database **setelah migrasi**, pada database
khusus WAPALA:

```sql
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO wapala_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO wapala_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO wapala_app;
REVOKE ALL ON TABLE public."_prisma_migrations" FROM wapala_app;
REVOKE UPDATE, DELETE ON TABLE public."AuditLog" FROM wapala_app;
```

Akun ini tidak boleh memiliki tabel, menerima hak `TRUNCATE`, atau memiliki hak
DDL dari role lain. Audit juga dilindungi trigger append-only. Sesuaikan nama
role/schema bila berbeda. Terapkan kembali izin setelah migrasi yang menambah
tabel; pertahankan pembatasan `AuditLog`.

Simpan URL runtime sebagai `DATABASE_URL` di Vercel. URL migrator tetap di
perangkat operator atau sistem migrasi privat, bukan runtime aplikasi.

## 2. Buat secret instalasi

Ada dua nilai berbeda:

- `SECURITY_KEY`: 32 byte acak dalam **base64**, untuk fungsi keamanan aplikasi.
  Pertahankan nilainya selama instalasi berjalan.
- `INITIAL_SETUP_TOKEN`: 32 byte acak dalam **base64url**, panjang 43 karakter.
  Hanya untuk pembuatan Super User pertama.

Dari root checkout, perintah berikut menulis masing-masing ke file lokal tanpa
menampilkan nilainya. Perintah menolak menimpa file yang sudah ada. Dapat
dijalankan di PowerShell maupun shell Linux/macOS dengan Node.js 24:

```sh
node -e "const fs=require('node:fs'),c=require('node:crypto');fs.writeFileSync('.env.secret.key','SECURITY_KEY='+c.randomBytes(32).toString('base64')+'\n',{flag:'wx',mode:0o600})"
node -e "const fs=require('node:fs'),c=require('node:crypto');fs.writeFileSync('.env.secret.token','INITIAL_SETUP_TOKEN='+c.randomBytes(32).toString('base64url')+'\n',{flag:'wx',mode:0o600})"
```

Buka file tersebut sendiri untuk menyalin nilai ke Vercel. Salin nilai setelah
`=`, bukan seluruh baris. Simpan `SECURITY_KEY` juga di password manager/backup
privat. Pada Windows, periksa izin akses file; mode Unix tidak menggantikan ACL
Windows.

`.env.secret.token` tidak otomatis dibaca Vercel. File `.env*` privat, `.local`,
dan `.vercel` tidak boleh ikut Git atau ZIP. Jangan menyimpan token instalasi di
tabel database yang dapat dibaca, folder `public`, atau variabel berawalan
`NEXT_PUBLIC_`.

## 3. Import project ke Vercel

Pilih **Add New → Project** di Vercel, lalu import `WapalaTUP/website_wapala`.
Pilih akun/team pengelola website, bukan project lama milik akun lain.

| Pengaturan | Nilai |
| --- | --- |
| Production Branch | `main` |
| Root Directory | Root repository (`.`), bukan `Wapala_git` atau `Vercel` |
| Framework Preset | Next.js |
| Node.js Version | `24.x` |
| Install Command | `npm ci` |
| Build Command | `npm run db:generate && npm run build` |
| Output Directory | Default Next.js |

Install/build/framework sudah didefinisikan di `vercel.json`. Jangan mengganti
build menjadi `npm run dev`, menjalankan `npm start` sebagai build, atau memilih
folder `public` sebagai output. Lihat [pengaturan Node.js Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
untuk pemilihan versi 24.x.

Tambahkan environment berikut sebelum deploy. Untuk URL database, kunci, dan
token, pilih tipe **Secret**.

| Variabel | Isi |
| --- | --- |
| `APP_URL` | Origin HTTPS pengunjung tanpa path/query, misalnya `https://nama-project.vercel.app` |
| `DATABASE_URL` | URL PostgreSQL cloud milik runtime, bukan migrator |
| `SECURITY_KEY` | Nilai base64 dari langkah sebelumnya |
| `INITIAL_SETUP_TOKEN` | Token base64url instalasi baru; hapus setelah setup berhasil |
| `WAPALA_MODE` | `backend` |
| `EMAIL_MODE` | `disabled` untuk operasi awal tanpa email |
| `TRUST_PROXY` | `true` untuk akses langsung melalui ingress Vercel; lihat catatan berikut |
| `NEXT_TELEMETRY_DISABLED` | `1`, opsional |

Vercel menyiapkan `NODE_ENV=production` untuk deployment. Jangan memakai
`EMAIL_MODE=sink`, `WAPALA_MODE=preview`, atau origin HTTP pada deployment,
termasuk Preview; validator server menolaknya.

`TRUST_PROXY=true` membuat throttle membaca IP dari `x-forwarded-for`. Pada
akses langsung melalui Vercel, header disediakan platform dan input luar
ditimpa untuk mencegah spoofing. Jika menambah proxy di depan Vercel, periksa
kembali rantai kepercayaannya. Dengan `false`, IP dianggap tidak diketahui dan
pengguna dapat berbagi bucket throttle. Rujukan:
[request headers Vercel](https://vercel.com/docs/headers/request-headers#x-forwarded-for).

Gunakan URL project sebagai `APP_URL`. Jika URL akhirnya berbeda, perbarui
nilainya dan redeploy **sebelum menguji formulir/login**. Jangan memakai URL
deployment acak yang berbeda dari origin tersebut.

Pilih environment **Production** untuk nilai produksi. Preview harus memakai
database dan secret terpisah serta origin Preview yang sesuai. Jangan mencentang
Production dan Preview bersamaan untuk URL database yang sama. Perubahan
environment baru berlaku pada deployment baru. Lihat [pengaturan environment](https://vercel.com/docs/environment-variables).

Tidak perlu menambahkan `PORT`, `HOSTNAME`, Nginx, atau IP internal VPS. Jangan
menyalin `.env.production.example` mentah-mentah: itu masih template native/VPS.
Setelah database dimigrasikan dan environment benar, jalankan **Deploy**.

## 4. Buat akun Super User

1. Buka `https://URL-PROJECT/wapala` pada origin yang sama dengan `APP_URL`.
2. Masukkan `INITIAL_SETUP_TOKEN` yang disimpan dan pilih password baru,
   minimal 12 karakter.
3. Setelah berhasil, login sebagai `superuser@wapala.org` dengan password baru
   tersebut. Tidak ada password bawaan.
4. Hapus `INITIAL_SETUP_TOKEN` dari konfigurasi Vercel dan salinan file token
   lokal. Simpan password admin di pengelola password organisasi.

Token berlaku 30 menit sejak konteks login/bootstrap pertama diakses, bukan
sejak build dimulai. Database menyimpan hash, bukan token asli. Request berulang
dan redeploy tidak memperpanjang masa berlakunya.

Setelah akun berhasil dibuat, token langsung hangus dalam transaksi yang sama.
Secret lama pada deployment sebelumnya pun tidak membuka ulang setup. Mengganti
token atau redeploy tidak mereset akun yang sudah ada.

Jika kedaluwarsa sebelum setup selesai, buat token baru, ganti secret, lalu
redeploy. Token lama tidak dapat diaktifkan lagi. Bila ada token aktif berbeda,
aplikasi menolak penggantian sampai token aktif kedaluwarsa; periksa konfigurasi
dan jangan menjalankan alur token CLI bersamaan. Jangan menghapus `BootstrapState`
atau akun untuk mengulang instalasi.

## 5. Periksa deployment

Gunakan browser pada origin yang ditetapkan di `APP_URL`:

- `/` terbuka tanpa error server.
- `/api/health` mengembalikan HTTP 200 dan `status: "ok"`.
- `/wapala` menampilkan setup pada instalasi baru, lalu login setelah setup.
- Login admin berhasil; logout mencabut sesi.
- API admin tanpa login menolak akses, bukan menampilkan data pengelola.
- Formulir memeriksa input, consent, CSRF, dan benar-benar menyimpan data.
- Hak setiap peran sesuai; akun biasa tidak dapat menjalankan reset Super User.

Health endpoint hanya menjalankan `SELECT 1`. Hasil 200 bukan bukti seluruh
migrasi, izin tabel, upload, atau alur bisnis sudah benar. Periksa runtime logs
setelah halaman dibuka, bukan build logs saja. Jangan menyalin cookie, jawaban
formulir, URL database, atau token ke laporan bug.

## Media, album, dan data awal

Repository berisi kode, bukan backup isi website. Clone/deploy tidak menyalin
akun, anggota, inventaris, album, angkatan, atau berkas VPS. Paket publik
album/angkatan yang disiapkan terpisah belum disertakan di repository ini.
Data anggota dan inventaris tidak termasuk paket publik tersebut.

Importer lama ada di `scripts/import-public-site.ts`. Ia memerlukan manifest,
berkas sumber, filesystem privat, dan scanner native. Jangan menjalankannya
sebagai build step Vercel atau menganggapnya sudah menjadi importer Blob.
Pemindahan data dilakukan terpisah setelah storage Vercel selesai.

Pekerjaan media yang masih dibutuhkan: adapter storage permanen, pembacaan file
privat dengan izin yang sama, layanan scanning, dan upload yang sesuai dengan
batas platform. `/tmp` bukan penyimpanan permanen. Jangan mengisi
`MEDIA_ROOT=/tmp` atau membuat scanner palsu untuk meloloskan upload.

Payload request/response Function biasa dibatasi 4,5 MB, sedangkan beberapa
form aplikasi menerima file sampai 5 MB. Penyesuaian upload harus menangani
batas platform tanpa melewati pemeriksaan keamanan. Rujukan:
[batas Vercel Functions](https://vercel.com/docs/functions/limitations#request-body-size).

## Email dan pemulihan akun

Dengan `EMAIL_MODE=disabled`, aplikasi tidak mengirim notifikasi atau email
pemulihan. Alamat pemulihan organisasi yang tersimpan tidak membuat email aktif.

Untuk pemulihan Super User, gunakan terminal interaktif pada perangkat operator
tepercaya. Buat `.env.operator` privat berisi environment runtime tujuan:
`NODE_ENV=production`, `APP_URL`, `DATABASE_URL`, `SECURITY_KEY`,
`WAPALA_MODE=backend`, `EMAIL_MODE=disabled`, dan `TRUST_PROXY`. Pastikan database
cloud dapat dijangkau dari perangkat tersebut.

```sh
node --env-file=.env.operator --conditions=react-server --import tsx scripts/recover-superuser.ts
```

Script meminta password baru dua kali melalui prompt tersembunyi, membuka kunci
akun, dan mencabut sesi lama. Jangan menaruh password pada argumen. Tidak perlu
SSH ke Vercel: script dijalankan di perangkat operator dan mengakses database
tujuan. Jangan memakai environment VPS atau database Preview yang keliru.

Akun lain dapat direset Super User melalui panel. Jika email ingin diaktifkan,
siapkan SMTP nyata dan eksekusi worker outbox terlebih dahulu. Mengisi `SMTP_*`
saja belum menyediakan worker terjadwal di Vercel.

## Update, domain, dan rollback

Pada project yang terhubung ke Git, push ke `main` memicu deployment Production.
Branch lain menghasilkan Preview sesuai pengaturan project. `main` repository
ini berbeda dari `main` repository deployment VPS lama; jangan mengganti remote
repository lama untuk memperbarui Vercel.

Untuk update dengan perubahan database:

1. Backup database dan media permanen yang sudah tersedia.
2. Tinjau migrasi, jalankan dengan role migrator pada database tujuan, lalu
   pastikan kode yang sedang aktif masih kompatibel.
3. Terapkan izin runtime untuk tabel baru, kemudian deploy kode yang sesuai.
4. Periksa runtime dan alur yang berubah sebelum menerima traffic umum.

Urutan itu untuk migrasi additive yang kompatibel dengan versi lama. Perubahan
yang memutus kompatibilitas memerlukan jadwal pemeliharaan/rencana transisi
sendiri. Jangan menjalankan migrasi produksi pada setiap Preview build.

Tambahkan domain melalui Settings → Domains pada project tujuan, lalu ikuti
record DNS yang diberikan Vercel. Ubah `APP_URL` ke origin canonical dan redeploy.
Jangan memindahkan domain yang masih melayani VPS sebelum ada keputusan cutover.

Rollback deployment mengembalikan kode, bukan database, data, atau media.
Pastikan versi lama dapat membaca schema/data saat ini. Jangan mereset database
sebagai cara rollback kode. Simpan backup database dan media di luar repository,
dan uji pemulihannya.

## Masalah yang sering muncul

| Gejala | Yang diperiksa |
| --- | --- |
| Repository tidak muncul di Vercel | Izin GitHub App pada organisasi/repository tujuan |
| Prisma Client tidak ditemukan saat build | Root Directory dan Build Command; generate harus berjalan sebelum build |
| `CONFIG_INVALID` | `APP_URL`, URL database, base64 `SECURITY_KEY`, dan mode backend/email |
| Health 503 | Koneksi database, TLS, role, batas koneksi, dan ketersediaan database |
| Health 200 tetapi halaman gagal | Migrasi/tabel dan izin runtime; health tidak membaca tabel aplikasi |
| Login/form ditolak karena origin | Browser membuka origin berbeda dari `APP_URL`; ubah environment lalu redeploy |
| `SETUP_TOKEN_CONFIG_INVALID` | Token harus 43 karakter base64url, tanpa nama variabel, spasi, atau newline |
| `SETUP_TOKEN_CONFLICT` | Masih ada token aktif berbeda pada database tujuan |
| `SETUP_TOKEN_REUSED` atau token kedaluwarsa | Buat token baru dan redeploy; jangan aktifkan kembali token lama |
| Setup tidak muncul | Periksa status instalasi/keberadaan Super User; gunakan pemulihan, bukan reset tabel |
| Upload gagal / `SCANNER_UNAVAILABLE` | Storage dan scanner belum terintegrasi; menambah token Blob bukan perbaikannya |
| File hilang setelah redeploy | Storage permanen atau adapter pembacanya belum tersedia |
| Upload 413 | Payload melewati batas Function; periksa alur upload, bukan hanya batas input form |
| Email pemulihan tidak ada | Mode `disabled` tidak mengirim email; gunakan prosedur operator |
| Banyak pengguna terkena throttle bersama | Periksa `TRUST_PROXY` dan sumber header IP pada ingress |

## Pemeriksaan kode

Jalankan pada checkout/runner pengujian dengan database test terpisah, bukan
environment produksi:

Siapkan `APP_URL`, `DATABASE_URL`, `TEST_DATABASE_URL`, `SECURITY_KEY`,
`WAPALA_MODE`, dan `EMAIL_MODE` khusus pengujian pada runner. Jangan memaksakan
`NODE_ENV=production` ketika menjalankan tes integrasi. Untuk build, gunakan
origin HTTPS dan `EMAIL_MODE=disabled`; `sink` ditolak pada mode produksi.

```sh
npm ci
npm run db:generate
npm test
npm run test:backend
npm run test:backend:integration
npm run typecheck
npm run lint
npm run build
```

Tes integrasi memerlukan `TEST_DATABASE_URL` ke database khusus bernama akhiran
`_test`; runner membuat dan membersihkan schema sementara. Jangan memakai
database produksi atau menyalin environment produksi ke runner test.
`npm run dev` hanya untuk development, bukan deployment Vercel.

Folder `deploy/`, workflow artifact Linux, dan dokumen Ubuntu/NAT yang masih ada
merupakan perlengkapan deployment native. [README-VERCEL.md](README-VERCEL.md)
berisi panduan ringkas untuk deploy melalui Git atau CLI pada akun/project
pilihan pengelola. Persiapan database dan operasional tetap mengikuti README ini.
