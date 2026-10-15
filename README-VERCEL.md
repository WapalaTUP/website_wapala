# WAPALA — deployment tambahan untuk testing Vercel

Kode aplikasi yang sama digunakan kembali; tidak ditulis ulang. Checkout lokal
`Dev_Website/Vercel` memakai branch `vercel`. Tidak ada koneksi Git yang diperlukan
untuk mengunggah atau memperbarui deployment ini.

## Target dan batas isolasi

- Akun/workspace: `hulwanulazkap`.
- Proyek: `wapala-testing` (bukan `wapala_dev`, SLA, atau VPS).
- Database cloud: schema khusus `wapala_vercel_testing` di Neon, dengan role
  runtime `wapala_vercel_app`. Data VPS tidak disalin. Tabel/schema lama tidak dihapus.
- Password, sesi, kunci keamanan, dan inisialisasi Super User testing terpisah.
- `wapala.my.id`, DNS, main, dan layanan VPS tidak berubah.
- File `.env*`, `.local`, `.git`, hasil build, serta generated Prisma tidak
  diunggah. Prisma Client dibuat ulang saat cloud build, bukan disimpan ke Git.

## Upload langsung dari folder ini

```powershell
npx --yes vercel@64.0.2 login
npx --yes vercel@64.0.2 link --yes --scope hulwanulazkap --project wapala-testing
npx --yes vercel@64.0.2 project inspect --non-interactive --scope hulwanulazkap
npx --yes vercel@64.0.2 deploy --dry --json --scope hulwanulazkap
npx --yes vercel@64.0.2 deploy --target preview --scope hulwanulazkap --project wapala-testing
```

Pastikan owner/project sesuai sebelum deploy. Proyek baru dapat menjadikan
deployment pertamanya sebagai production di proyek testing tersebut; label itu
tidak menunjuk VPS. Gunakan URL testing yang ditetapkan pada `APP_URL` untuk
login/form agar pemeriksaan Origin/CSRF tetap konsisten. Setelah deployment baru
lulus verifikasi, arahkan alias testing ke URL deployment itu jika diperlukan:

```powershell
npx --yes vercel@64.0.2 alias set <deployment-url> wapala-testing-hulwanulazkap.vercel.app --scope hulwanulazkap
```

Build Vercel: `npm run db:generate && npm run build`. Migrasi database adalah
langkah operator terpisah pada schema testing yang telah diverifikasi, bukan
reset/seed otomatis setiap deployment. Jangan arahkan `DATABASE_URL` ke VPS.

## Batas testing saat ini

- Build/deployment dan database dapat diuji; ini belum migrasi penuh seluruh
  layanan VPS ke Vercel.
- Upload media masih menggunakan private filesystem dan executable ClamAV lokal.
  Belum ada object storage atau scanner remote untuk proyek ini. Jangan menganggap
  upload/penyimpanan file sudah berfungsi di Vercel; keamanan tidak dibypass.
- Email dinonaktifkan. Akun testing tidak memakai password/email pemulihan VPS.
- Deployment protection Vercel tidak dinonaktifkan. Pemilik dapat login Vercel;
  operator dapat memeriksa preview menggunakan `vercel curl`.
- Inisialisasi baru dapat memakai Secret Environment Variable
  `INITIAL_SETUP_TOKEN`; tidak perlu SSH untuk menerbitkan token. Lihat prosedur
  di bawah. File token testing lama tidak menjadi prasyarat deployment baru.

Verifikasi build/health bukan bukti semua alur fitur (khususnya upload) telah QA.

## Inisialisasi Super User dari environment (termasuk akun WAPALA baru)

Kode mekanisme token ini tersedia pada branch `vercel`. Terapkan semua migrasi
sebelum menjalankan versi ini, termasuk
`202610160002_environment_bootstrap_token`. Dengan koneksi **migrator** database
tujuan yang sudah dikonfigurasi secara privat, jalankan `npm ci`,
`npm run db:generate`, lalu `npm run db:migrate`. Jangan memakai database VPS atau
`db push`/reset. Build saat ini belum menjalankan migrasi secara otomatis.

1. Buat token acak 32 byte, format base64url (43 karakter). Contoh PowerShell
   berikut menyimpannya ke file privat lokal tanpa mencetak nilai ke terminal;
   perintah menolak menimpa file yang sudah ada:

   ```powershell
   node -e "const fs=require('node:fs'),c=require('node:crypto');fs.writeFileSync('.env.secret.token','INITIAL_SETUP_TOKEN='+c.randomBytes(32).toString('base64url')+'\n',{flag:'wx',mode:0o600})"
   ```

   Lindungi akses file tersebut pada komputer bersama. File `.env.secret.token`
   sudah dikecualikan oleh `.gitignore` dan `.vercelignore`. Jangan masukkan ke
   Git, ZIP, folder `public`, atau membagikannya. Nama file ini **tidak** membuat
   Vercel otomatis membacanya.
2. Pada project Vercel tujuan, buka Settings → Environment Variables. Tambahkan
   `INITIAL_SETUP_TOKEN` sebagai **Secret**, berisi nilai setelah tanda `=` dari
   file tadi (bukan seluruh baris), untuk environment Production. Jangan gunakan
   prefix `NEXT_PUBLIC_`. Preview harus memakai database dan token berbeda.
3. Deploy/redeploy agar secret tersedia pada runtime. Buka `/wapala`; akses
   pertama ke konteks login mendaftarkan **hash** token dan memulai masa berlaku
   30 menit. Membuka ulang halaman atau redeploy tidak memperpanjangnya. Tidak
   ada token yang ditampilkan di website, database dalam bentuk asli, atau log.
4. Masukkan token yang disimpan tadi dan tentukan password baru minimal
   12 karakter. Akun yang dibuat adalah `superuser@wapala.org`. Tidak ada
   password bawaan atau akun yang disalin dari VPS.
5. Setelah berhasil, token langsung hangus dalam transaksi pembuatan akun.
   Redeploy, nilai secret lama/baru, maupun penghapusan secret tidak membuka
   ulang instalasi. Hapus `INITIAL_SETUP_TOKEN` dari pengaturan Vercel dan hapus
   file lokal sesudah berhasil; nilai secret pada deployment lama pun tidak
   dapat dipakai menginisialisasi ulang akun.

Jika lewat 30 menit sebelum selesai: buat **token baru**, ubah secret, lalu
redeploy dan buka `/wapala` kembali. Token kedaluwarsa yang sama tidak dapat
diaktifkan lagi, termasuk setelah pernah diganti token lain. Jika token aktif
berbeda (misalnya token CLI sebelumnya), tunggu token itu kedaluwarsa atau
gunakan deployment dengan konfigurasi token yang sesuai; aplikasi tidak diam-
diam menimpanya. Jangan menghapus `BootstrapState` atau akun untuk mengulang
setup. Mekanisme CLI `npm run auth:bootstrap-token` tetap tersedia bagi operator
yang mengelola server sendiri; jangan mencampur kedua alur saat token masih aktif.

Penerapan token ini **tidak** mengubah batas upload/filesystem/scanner di atas
dan bukan klaim bahwa keseluruhan aplikasi sudah siap produksi di Vercel.
