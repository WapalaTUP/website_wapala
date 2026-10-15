# Rancangan deployment WAPALA di Vercel

Status: implementasi token environment dikerjakan terpisah pada 16 Oktober 2026;
rancangan deployment lengkap, Blob, dan impor di bawah belum seluruhnya diterapkan.
Lihat README-VERCEL.md untuk prosedur yang benar-benar tersedia.

## Tujuan dan batas perubahan

- Revisi aplikasi yang ada pada branch `vercel`, tanpa menulis ulang website.
- Hasil akhir dapat disalin ke root repository
  `https://github.com/WapalaTUP/website_wapala.git`, branch `main`.
- VPS, domain produksi yang sekarang, dan branch `main` repository lama tidak
  berubah. Jangan membawa folder `.vercel`, konfigurasi akun testing, atau secret
  komputer operator ke repository tujuan.
- Satu deployment produksi dimungkinkan setelah pemilik menyiapkan resource,
  izin, environment, dan paket impor yang diperlukan. Git saja tidak dapat
  memberikan izin akun atau menyediakan secret secara otomatis.

## Token inisialisasi Super User

1. Operator membuat token acak 32 byte dalam format base64url (43 karakter).
   Salinan lokal boleh disimpan dalam `.env.secret.token`, yang tidak boleh ikut
   Git, ZIP, upload deployment, atau folder publik. File ini bukan konfigurasi
   yang otomatis dibaca Vercel.
2. Operator memasukkan nilai yang sama sebagai Secret Environment Variable
   `INITIAL_SETUP_TOKEN` di environment Production project tujuan. Tidak memakai
   prefix `NEXT_PUBLIC_`, nilai dalam Git, atau record token terbaca di database.
3. Akses pertama ke konteks login (atau pengajuan bootstrap langsung) membuat
   foundation bila belum ada dan merekam hash beserta kedaluwarsa 30 menit.
   Build tidak memulai masa berlaku token. Tidak mencetak nilainya. Penulisan
   dikunci secara transaksional; deploy bersamaan tidak mengubah token yang masih
   berlaku. Token yang berbeda saat instalasi aktif ditolak sebagai konflik.
4. Operator membuka `/wapala`, memasukkan token dan memilih password sendiri.
   Gunakan validasi password, hashing, audit, dan transaksi bootstrap yang ada.
   Jangan membuat password default atau menyalin akun dari VPS.
5. Setelah berhasil, transaksi mengisi status selesai dan menghapus hash serta
   masa berlaku token. Token tidak dapat digunakan lagi. Redeploy, secret lama,
   atau penggantian secret tidak membuka ulang instalasi yang selesai.
6. Token yang kedaluwarsa tidak diaktifkan lagi dengan token yang sama. Jika
   instalasi belum selesai, operator mengganti secret dengan token baru dan
   redeploy untuk membuka jendela 30 menit baru. Simpan sidik token kedaluwarsa
   agar percobaan pengaktifan ulang nilai yang sama ditolak.
7. Setelah setup berhasil, operator menghapus secret dari konfigurasi project
   dan salinan lokal. Hilangnya secret tidak menggagalkan build instalasi yang
   sudah selesai. Pemulihan akun merupakan alur operator terpisah, bukan reset
   status instalasi.

## Database dan build

- README membedakan URL koneksi migrasi dengan URL runtime berizin terbatas.
  Jangan memberikan hak migrasi ke koneksi runtime atau mengarahkannya ke VPS.
- Urutan: validasi environment, generate Prisma Client, migrasi additive, izin
  runtime, foundation/bootstrap, impor yang diminta, lalu build Next.js.
- Jangan memakai `db push`, reset, penghapusan schema, atau seed password.
- Preview dan Production memakai database/schema serta secret terpisah. Deploy
  Preview tidak boleh menjalankan persiapan atau impor pada database Production.
- Gagal validasi/migrasi/impor menghentikan deployment dengan pesan tanpa secret.
  Redeploy tidak menimpa settings, password, dan perubahan manual yang sudah ada.

## Media dan impor

- Gunakan Private Blob milik akun/project tujuan, bukan ID store testing yang
  di-hardcode. Resource harus terhubung ke environment yang benar.
- Pertahankan route `/api/media/<UUID>`, pemeriksaan akses, dan checksum. File
  privat tidak diubah menjadi URL publik permanen.
- Gunakan paket publik yang sudah ada pada staging: 21 angkatan, 22 album,
  129 foto album, dan 150 gambar total. Verifikasi manifest/checksum; jangan
  mengambil ulang situs sumber. Impor idempotent tidak menimpa perubahan manual.
- Anggota, inventaris, akun, password, sesi, dan token sumber tidak disertakan.
  Data operasional pribadi tambahan bukan bagian Git; bila dipindahkan, gunakan
  paket privat terpisah dengan pemeriksaan relasi dan berkas yang dirujuk.
- Upload saat ini masih filesystem + ClamAV executable; belum cocok untuk
  Vercel. Adaptasi upload harus mempertahankan scanning dan menangani batas
  request platform. Checksum bukan pengganti antivirus.
- Penyedia scanner remote belum dipilih. Implementasi bootstrap/README tidak
  boleh dinyatakan menyelesaikan hambatan upload ini. Sebelum promosi produksi
  penuh, selesaikan keputusan scanner dan verifikasi seluruh alur upload.

## README tujuan

README utama branch `vercel` menjadi panduan Vercel generik: akun GitHub/Vercel,
Node versi yang didukung proyek, database dan izin, Private Blob, scanner,
environment wajib/opsional, pembuatan secret tanpa mencetaknya, import Git main,
Root Directory repository root, setup admin, rotasi token kedaluwarsa, impor,
domain/APP_URL, backup, redeploy, pemulihan, dan troubleshooting. Tidak memakai
path `.local` atau identitas akun lama sebagai prasyarat deploy.

## Verifikasi dan urutan rilis

1. Uji database baru, token salah/kedaluwarsa/dipakai ulang, bootstrap bersamaan,
   deploy ulang sebelum/sesudah setup, dan tidak adanya kebocoran token.
2. Uji migrasi ulang tanpa reset, isolasi Preview/Production, izin runtime,
   impor kedua tanpa duplikasi, checksum media, dan penolakan akses media privat.
3. Uji login admin, peminjaman, formulir, upload, album/angkatan, dan unduhan
   pada deployment Vercel; status build Ready saja bukan hasil QA seluruh fitur.
4. Audit daftar file sebelum push: tidak ada `.env*` rahasia, `.vercel`, `.local`,
   data anggota/inventaris, generated output, atau kredensial.
5. Setelah perubahan lolos pemeriksaan, commit/push branch `vercel`; kemudian
   salin riwayat/kode yang disepakati ke `main` repository WapalaTUP. Periksa
   keadaan repository tujuan terlebih dahulu; jangan force-push atau menghapus
   pekerjaan yang sudah ada tanpa persetujuan khusus.
