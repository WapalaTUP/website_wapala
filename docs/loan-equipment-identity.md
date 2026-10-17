# Jenis alat pada katalog peminjaman

Setiap jenis alat menggunakan baris inventaris, kode, dan stoknya sendiri. Contoh: Carabiner / Autolock, Carabiner / Screw, Carabiner / Snap. Gunakan field **Jenis / tipe / warna** yang sudah ada (`typeColor`); data lama dan format impor tetap dipertahankan. Foto memakai unggahan inventaris yang sudah tersedia. Jenis/foto kosong ditampilkan sebagai belum dicatat/tersedia, tanpa mengarang detail barang.

Katalog menampilkan foto, kode, jenis, merek, kategori, dan batas peminjaman; pencarian mencakup nama/kode/jenis/merek. Tombol tahap pertama berada di panel Sebelum berangkat dan tetap men-submit form pemilihan alat.

Migration `202610180001_loan_equipment_identity` hanya menambahkan kolom JSONB `LoanItem.equipmentSnapshot` dengan default `{}`. Saat pengajuan baru, server menyimpan kode, nama, dan jenis dari master inventaris di dalam transaksi dan lock alat yang sudah digunakan. Data klien tidak dipercaya untuk identitas barang. Detail admin, pelacakan, arsip, dan invoice memakai identitas tersebut. Pengajuan lama memakai data inventaris yang masih ada; jenis historis yang belum pernah dicatat tidak direkonstruksi.

## Pemeriksaan di VPS

Tidak ada build/test lokal dan tidak ada akses SSH pada perubahan ini. Sebelum rilis, jalankan generate Prisma, typecheck, test, dan build melalui alur deployment VPS. Migration bersifat additive karena staging/main berbagi database.

- Isi tiga baris Carabiner dengan jenis/kode berbeda; unggah foto alat sebenarnya.
- Cari Carabiner dan filter tiap jenis. Pilih jumlah Screw, lanjut lewat panel kanan, pastikan jenis/kode tampil di ringkasan.
- Ajukan, periksa identitas pada admin dan pelacakan; ubah master alat setelah pengajuan, identitas pada pengajuan baru tadi harus tetap sama.
- Periksa invoice dan arsip setelah reset inventaris pada database uji, bukan database bersama.
- Periksa foto, input jumlah, dan tombol lanjut pada desktop/ponsel; pastikan jenis tidak dipilih menghasilkan pesan validasi.

Alat baru hasil impor langsung `available: true` pada preview, penyimpanan server, dan mode demo. Impor tidak mengaktifkan ulang alat lama dan tidak menimpa kode yang sudah ada. Alat yang ditambahkan manual tetap mengikuti alur lama.
