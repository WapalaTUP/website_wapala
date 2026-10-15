# Deploy ke Vercel

Panduan ini berlaku untuk akun, team, dan project Vercel yang dipilih pengelola.
Tidak ada ketergantungan pada nama project, akun GitHub, domain, atau database
deployment sebelumnya. Persiapan database, izin runtime, dan pemulihan akun
dijelaskan lengkap di [README utama](README.md).

## Persiapan

- Berikan Vercel akses ke repository yang akan dideploy.
- Siapkan PostgreSQL cloud dan jalankan seluruh migrasi pada database tujuan.
  Pisahkan role migrator dari role runtime aplikasi.
- Tentukan origin HTTPS yang dipakai pengunjung.
- Buat `SECURITY_KEY` dan token instalasi baru. Jangan menyalin secret atau sesi
  dari instalasi lain.
- Pisahkan database dan secret untuk Production, Preview, serta Development.

Build belum menjalankan migrasi atau import otomatis. Menyalin repository tidak
ikut menyalin resource cloud, akun pengguna, data, atau media.

## Deploy melalui Git

Import repository melalui **Add New → Project**, pada akun/team tujuan.
Gunakan pengaturan ini:

| Pengaturan | Nilai |
| --- | --- |
| Framework | Next.js |
| Root Directory | Root repository yang berisi `package.json` dan `vercel.json` |
| Node.js | `24.x` |
| Install Command | `npm ci` |
| Build Command | `npm run db:generate && npm run build` |
| Output Directory | Default Next.js |
| Production Branch | Branch rilis yang dipilih pengelola, biasanya `main` |

Konfigurasi build tersedia di `vercel.json`. Jangan memakai `npm run dev` untuk
deployment. Push ke Production Branch memicu deployment produksi; branch lain
menjadi Preview sesuai pengaturan project.

Sebelum deploy, isi environment pada project tujuan:

| Variabel | Keterangan |
| --- | --- |
| `APP_URL` | Origin HTTPS canonical, tanpa path/query |
| `DATABASE_URL` | URL PostgreSQL runtime dengan izin terbatas |
| `SECURITY_KEY` | 32 byte acak, format base64 |
| `INITIAL_SETUP_TOKEN` | 32 byte acak, base64url sepanjang 43 karakter; hanya saat instalasi baru |
| `WAPALA_MODE` | `backend` |
| `EMAIL_MODE` | `disabled` untuk operasi tanpa email |
| `TRUST_PROXY` | `true` untuk ingress langsung Vercel; tinjau ulang jika ada proxy tambahan |
| `NEXT_TELEMETRY_DISABLED` | `1`, opsional |

Gunakan tipe **Secret** untuk URL database, kunci, dan token. Jangan memberi
prefix `NEXT_PUBLIC_` pada secret. Preview memerlukan origin dan database sendiri,
bukan salinan koneksi Production. Mode `preview` aplikasi dan email `sink` tidak
diizinkan pada runtime production, termasuk deployment Preview Vercel.

Setelah mengubah environment, buat deployment baru. Deployment sebelumnya tidak
mengambil perubahan tersebut. Pastikan URL yang dibuka sama dengan `APP_URL`
sebelum menguji login dan formulir.

## Alternatif: upload melalui CLI

Jalankan dari root checkout. Ganti `NAMA_TEAM` dan `NAMA_PROJECT` dengan tujuan
yang sebenarnya; keduanya bukan nilai bawaan aplikasi.

```sh
npx vercel login
npx vercel link --scope NAMA_TEAM --project NAMA_PROJECT
npx vercel project inspect --scope NAMA_TEAM
npx vercel deploy --dry --json --scope NAMA_TEAM
```

Periksa `.vercel/project.json` dan hasil inspeksi sebelum mengunggah. Pastikan
team/project benar dan daftar file tidak mencakup `.env*` privat, `.local`,
database, hasil build lokal, atau paket data organisasi.

Setelah itu, pilih target yang memang ingin diterbitkan:

```sh
# Preview
npx vercel deploy --target preview --scope NAMA_TEAM

# Production
npx vercel deploy --prod --scope NAMA_TEAM
```

Dua perintah tersebut adalah pilihan, bukan urutan yang wajib dijalankan.
Periksa target dan URL hasilnya, terutama pada deployment pertama project baru.
Upload CLI tidak otomatis menghubungkan repository Git untuk update berikutnya.

## Inisialisasi akun

Buat `INITIAL_SETUP_TOKEN` pada perangkat operator, simpan salinannya secara
privat, lalu tambahkan nilainya ke environment Vercel sebelum deploy. File lokal
seperti `.env.secret.token` bukan file konfigurasi yang dibaca otomatis Vercel.
Cara membuat token tanpa mencetaknya tersedia di [README utama](README.md).

Buka `/wapala`, masukkan token, lalu tentukan password Super User sendiri.
Token berlaku 30 menit sejak konteks login/bootstrap pertama diakses. Database
menyimpan hash, bukan nilai token asli. Membuka ulang halaman dan redeploy tidak
memperpanjang masa berlaku.

Token langsung hangus setelah akun berhasil dibuat. Setup tetap tertutup meski
secret diganti atau aplikasi dideploy ulang. Hapus secret instalasi dan salinan
token lokal setelah berhasil; pertahankan `SECURITY_KEY`.

Jika token kedaluwarsa sebelum selesai, buat token baru, ubah environment, lalu
redeploy. Token lama tidak dapat diaktifkan lagi. Jangan menghapus status
instalasi atau akun untuk mengulang setup, dan jangan mencampur token CLI dengan
token environment yang masih aktif.

## Batas yang perlu diperhatikan

Storage media masih filesystem privat dengan scanner ClamAV native. Adapter
Blob dan scanner yang cocok untuk Vercel belum tersedia pada kode ini. Menambah
Blob store atau tokennya tidak membuat upload dan pembacaan media otomatis
berfungsi. Jangan memakai `/tmp` sebagai penyimpanan permanen atau melewati
pemeriksaan scanner.

Migrasi data, media lama, worker email, dan pekerjaan terjadwal memerlukan
penyiapan tersendiri. Dengan `EMAIL_MODE=disabled`, email pemulihan tidak dikirim;
pemulihan Super User dilakukan dari terminal operator yang terhubung ke database
tujuan, bukan melalui SSH ke Vercel.

## Setelah deploy

Periksa halaman publik, `/api/health`, setup/login/logout, izin admin, formulir,
dan runtime logs. Health hanya memeriksa koneksi database, bukan seluruh schema
atau fitur. Status Ready juga bukan hasil pengujian semua alur.

Sebelum layanan dibuka untuk umum, selesaikan storage/scanning dan uji upload,
media privat, alur bisnis, serta backup/restore. Gunakan domain sendiri setelah
deployment tujuan lolos pemeriksaan; perbarui `APP_URL` dan redeploy ketika
origin canonical berubah.

Rujukan platform: [deploy dari Git](https://vercel.com/docs/git),
[environment variables](https://vercel.com/docs/environment-variables), dan
[batas Functions](https://vercel.com/docs/functions/limitations).
