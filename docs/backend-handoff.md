# Ketentuan backend dari pengguna

Frontend lokal menggunakan data demo untuk menilai desain dan alur. Data demo tidak boleh menjadi seed produksi.

## Deployment pertama

- Inventarisasi seluruh berkas Src, validasi skema dan duplikasi, lalu impor anggota, konten, buku, foto, dan aset yang sesuai ke basis data/storage server. Berkas sensitif tidak masuk public atau bundle frontend.
- Gunakan migrasi/import satu kali yang idempotent dan berversi. Restart, build ulang, dan deployment berikutnya tidak mengulang impor atau menimpa perubahan admin.
- Publikasi konten hasil impor sesuai izin dan validasi organisasi. Tanggal yang belum diketahui tidak ditebak dari nama berkas; metadata tanggal contoh frontend tidak diimpor.
- Slideshow menggunakan sepuluh foto publik paling baru berdasarkan uploaded_at server, berganti setiap lima detik, mempertahankan rasio asli, dan mengecualikan foto/album yang diarsipkan.
- Admin dapat mengunggah foto highlight manual dengan judul, keterangan, dan tanggal. Foto pilihan tampil sebelum sepuluh foto terbaru; deduplikasi mencegah foto yang sama muncul dua kali. Sediakan urutan, aktif/nonaktif, dan opsi menghapus highlight tanpa menghapus album.

## Bootstrap akun

- Saat belum ada Super User, /wapala menampilkan pembuatan password Super User. Lindungi bootstrap dengan token instalasi atau akses pemilik server; pengunjung anonim tidak boleh mengambil alih akun pertama.
- Password di-hash di server. Bootstrap ditutup atomik setelah akun pertama terbentuk; build ulang tidak membuka bootstrap lagi.
- Super User membuat admin lain dengan role. Gunakan password sementara sekali pakai dan wajib menggantinya saat login pertama.
- Auth, izin, sesi, audit, dan validasi diterapkan di server; mekanisme demo localStorage/sessionStorage harus dilepas sebelum produksi.

## Fitur bersyarat

Open Recruitment dan Donasi tidak masuk dropdown Layanan. CTA khusus berada di kanan Kontak, lalu sakelar tema. Banner pendaftaran dan halaman/alur terkait hanya aktif setelah admin membukanya. Nilai awal produksi nonaktif. Pengaturan harus tersinkron lintas sesi melalui server.

Periode OR bersifat tahunan: Periode 2024, Periode 2025, dan seterusnya. Tidak ada gelombang. Terapkan uniqueness pada tahun dan hanya satu periode aktif. Migrasi label gelombang lama menggabungkan periode per tahun tanpa menghapus pendaftar.

Kampanye & donasi memiliki menu admin tersendiri untuk editor kampanye, aktivasi, dan verifikasi. Pengaturan umum tidak boleh menimpa detail kampanye.

Reader PDF menampilkan dua halaman di desktop dan satu di mobile. Render hanya halaman aktif. Slideshow momen memakai lima kategori berbeda yang terbaru, masing-masing satu foto. Bentuk dua foto bertingkat dipertahankan.

## Referensi data frontend

## Kontrak revisi admin (preview selesai, server belum)

- Kampanye adalah entitas terpisah dengan ID stabil; setiap konfirmasi terikat campaignId. Total hanya konfirmasi terverifikasi dan tidak diarsipkan pada kampanye itu. Status aktif menentukan CTA dan penerimaan konfirmasi, diverifikasi ulang server saat submit.
- Setiap kampanye memiliki beberapa bankAccounts (id, bank, number, holder), poster donasi terpisah dari sampul, dan foto QRIS. Nomor rekening berupa teks, mempertahankan nol awal. Konfirmasi transfer menyimpan bankAccountId serta snapshot nama bank, nomor, dan pemilik untuk audit. Migrasi rekening lama tidak menebak nama pemilik; admin wajib melengkapinya saat menyimpan revisi.
- Poster/QRIS ditampilkan utuh, tidak dipotong. Data URL lokal hanya preview; produksi gunakan upload storage dengan validasi tipe, ukuran, izin, dan URL aman. Jangan menerima pembayaran nyata pada preview.
- Impor Anggota/Inventaris menerima CSV/XLSX, pemetaan kolom, validasi seluruh baris/duplikasi, pratinjau dan konfirmasi. Tambah baru saja; konflik memblokir seluruh batch. Formula tidak dieksekusi. Nilai identifier mempertahankan nol awal, termasuk format angka Excel multi-section. Server wajib transaksi atomik, audit dan pemeriksaan izin.
- Reset kepengurusan hanya Super User: peminjaman selesai/ditolak diarsipkan, kewajiban aktif dibawa ke periode baru tanpa perubahan status, barang, atau stok. Data OR tidak direset. Tahun baru harus lebih besar dari periode sekarang.
- Pilihan password pertahankan/ganti baru per pengguna serta reset Super User terpisah saat ini hanya merekam permintaan preview. Server wajib reset sebenarnya, password hash, token sekali pakai, wajib ganti dan pencabutan sesi. Identitas admin: POH@wapala.org, Logistik@wapala.org, Kerjasama@wapala.org; bukan pembuatan mailbox.
- Pengujian visual lanjutan memakai screenshot pengguna; pengguna meminta tidak mengoperasikan browser.

## Data publik referensi

- 21 angkatan dan 12 album publik disinkronkan dari website WAPALA aktif.
- 74 foto disimpan per album, tidak dicampur dengan dokumentasi kegiatan lain.
- Kunci urutan sementara aset publik bukan tanggal kegiatan yang telah diverifikasi.
- Kontak memakai embed lokasi Sekretariat WAPALA yang sama dengan website aktif.
