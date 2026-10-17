# Hapus satu data dan relasinya

Khusus Super User: tombol Hapus per baris pada Pengguna, Anggota, Inventaris, dan Peminjaman. Setiap tindakan menggunakan preview dampak, snapshot hash, konfirmasi tertulis, password, CSRF, dan pemeriksaan sesi. Tidak ada migration baru.

- Hapus Pengguna: akun, sesi login, dan token reset password dihapus. Profil anggota tetap ada.
- Hapus Anggota: profil beserta akun pengguna terkait, sesi login, token reset, dan riwayat koreksi ikut dihapus. Hubungan akun/koreksi tidak lagi memblokir reset. Akun sendiri dan Super User aktif terakhir tetap dilindungi, termasuk jika terhubung lewat profil anggota.
- Hapus Inventaris: item pada semua pinjaman, termasuk aktif, disalin ke arsip pinjaman lalu dilepas dari master inventaris. Detail peminjam dan alat lain tetap ada. UI detail, pelacakan, dan invoice menandai alat telah dihapus. Item tersebut tidak lagi dikirim untuk persetujuan atau pemeriksaan pengembalian stok. Status pinjaman tetap dikelola pengelola; penghapusan alat tidak mengubahnya otomatis.
- Hapus Peminjaman: data peminjaman, item, dan histori statusnya dihapus. Reservasi stok dilepas tanpa menghapus master alat. Catatan audit penghapusan tetap disimpan.
- Reset massal anggota/inventaris mengikuti perilaku relasi yang sama. Pengguna dan peminjaman hanya mendukung penghapusan satu data.

Format JSON arsip pinjaman tetap kompatibel dengan release lama yang memakai database bersama. Penanda `equipmentDeleted` diturunkan dari posisi item dalam arsip pada respons API, bukan field baru pada JSON tersimpan.

## Pemeriksaan di VPS

Tidak ada akses SSH atau build/test lokal oleh agen. `npm run test:delete:integration` menggunakan `.local/backend.env` untuk membuat database lokal `wapala_delete_test`, schema acak, migration, dan fixture terisolasi. Database live tidak dijadikan target tes. Tes mencakup cascade anggota/akun/koreksi, penghapusan alat pada pinjaman aktif, penanda arsip, item lain tetap ada, serta hapus peminjaman melepas reservasi. Jalankan generate Prisma, typecheck, tes, dan build pada VPS sesuai alur deployment.
