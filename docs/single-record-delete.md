# Hapus satu data

Tombol Hapus tersedia untuk Super User pada setiap baris Pengguna, Anggota, dan Inventaris. Menggunakan endpoint data-reset dengan `id` terpilih, preview hash, konfirmasi tertulis, password, CSRF, dan pemeriksaan sesi yang sudah ada. Tidak ada migration baru.

- Pengguna: hanya satu akun; akun sendiri dan Super User aktif terakhir diblokir. Sesi dan token reset password akun itu dihapus bersama akun. Profil anggota, konten, dan audit tidak dihapus.
- Anggota: profil terkait akun atau koreksi diblokir. Hapus/lepas tautan akun terlebih dahulu jika ingin menghapus profil. Riwayat koreksi tetap menjadi penghalang; gunakan arsip bila ingin menyembunyikan anggota dengan riwayat tersebut.
- Inventaris: pinjaman belum selesai/ditolak memblokir penghapusan. Item pada pinjaman selesai disalin ke arsip pinjaman sebelum dilepas; item lain pada pinjaman yang sama tetap ada.
- Reset massal anggota/inventaris tetap tersedia. Pengguna tidak mendukung reset massal.

Pengujian hanya pada VPS, tanpa akses SSH oleh agen. `npm run test:delete:integration` menggunakan `.local/backend.env` sebagai koneksi administrasi lokal, membuat database `wapala_delete_test` dan schema acak, lalu menerapkan migration dan fixture di sana. Database live tidak dijadikan target tes. Generate Prisma, jalankan typecheck dan build sesuai alur deploy biasa.

Skenario UI: hapus satu pengguna uji, pastikan profil anggotanya tetap ada; hapus profil tersebut setelah akun terlepas; pastikan baris lain tetap ada. Periksa alasan blokir ketika memilih anggota terkait akun/koreksi atau alat pada pinjaman aktif. Gunakan fixture/database uji untuk pengujian penghapusan permanen.
