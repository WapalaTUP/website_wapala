# Penggunaan Event WAPALA

## Pengelola

Super User dan Kerjasama/MULTIMEDIA membuka `/admin/event`. Tambah Event membuka editor dengan tab Pertanyaan, Respons dan Pengaturan. Pengguna POH/Logistik tidak mendapat akses jawaban peserta.

Tab Pertanyaan: tambah pertanyaan/bagian, pilih tipe, ubah pilihan, isi petunjuk, atur batas jawaban atau kondisi tampil, duplikasi dan urutkan lewat drag atau tombol naik/turun. Sakelar Wajib default mati. Template WAPALA hanya membuat pertanyaan awal, bukan mengunci Nama/NIM/WhatsApp sebagai identitas wajib.

Tab Pengaturan: judul kegiatan, keterangan, lokasi/jadwal opsional, kuota opsional, awal/akhir pendaftaran opsional, poster dan sampul. Kontrol tanggal admin menggunakan WIB (UTC+07). Kuota kosong berarti tidak dibatasi oleh event.

Simpan draft tidak mengubah formulir publik. Publikasikan menyimpan revision baru dan membuka event. Jawaban lama tetap mengacu formulir saat peserta mendaftar. Tipe/pilihan/baris kisi yang berubah makna memperoleh ID baru di server. Menghapus pertanyaan tidak menghapus respons lama. Pertanyaan yang masih dipakai sebagai kondisi perlu dilepas kondisinya sebelum dihapus.

Tutup pendaftaran langsung menghentikan penerimaan, tetapi detail event tetap dapat dibaca. Buka kembali menggunakan versi terakhir yang dipublikasikan, bukan perubahan draft yang belum diterbitkan. Arsip menyembunyikan event publik tanpa menghapus peserta.

## Peserta

Event aktif yang dipublikasikan menampilkan tombol Event di navigasi utama bersama OR/Donasi setelah Kontak. `/event` menampilkan kegiatan, `/event/[id]` menampilkan poster, keterangan dan formulir. Tanpa event yang diterbitkan tidak ada contoh kegiatan buatan.

Field opsional boleh kosong. Form dengan beberapa bagian memiliki navigasi berikutnya/kembali. Kondisi dihitung dari keseluruhan form, termasuk pilihan pada bagian sebelumnya. Pengiriman menerima kode referensi unik.

Jika jaringan putus setelah Kirim, gunakan tombol kirim ulang permintaan yang sama. Jangan membuka form baru untuk mengulang. Jika revision berganti saat mengisi, muat form terbaru dan tinjau jawaban yang masih sesuai. Sistem tidak menjamin satu orang satu pendaftaran bila pengelola tidak meminta identitas yang dapat dipakai untuk pemeriksaan manual.

Jika token kedaluwarsa ketika hasil pengiriman belum pasti, tombol berikutnya memeriksa hasil permintaan lama. Sistem memberi kode asli bila sudah diterima, atau menutup percobaan lama sebelum menawarkan form baru. Referensi berkas upload sengaja dibersihkan saat refresh; pilih ulang berkas agar sesuai sesi baru. Rekonsiliasi token lama dibatasi 24 jam setelah masa token normal berakhir.

## Respons dan Excel

Tab Respons menyediakan pencarian kode/jawaban, filter versi dan tanggal WIB, pagination dan detail sesuai label historis. Ekspor Excel mengikuti filter yang diterapkan (bukan hanya 50 baris di halaman), dengan data di sheet Pendaftar dan definisi historis di Kamus pertanyaan. NIM/WhatsApp/jawaban teks tetap teks sehingga nol awal dan ekspresi mirip formula tidak berubah makna.

Berkas peserta privat. Excel hanya menyertakan ID referensi berkas, tanpa link akses permanen. Membuka berkas membutuhkan sesi admin Event yang masih valid. Jangan membagikan ekspor berisi data peserta di repositori publik.

## Keamanan berkas dan perawatan

Poster/sampul: JPG/PNG/WebP. Berkas peserta: JPG/PNG/WebP/PDF maksimal 5 MB. Semua upload melewati pemeriksaan format dan pemindaian malware. Jika ClamAV tidak tersedia, upload ditolak, bukan diloloskan. UI/file pipeline tersedia, tetapi pemindai native Windows development belum diverifikasi. VPS perlu `clamscan`/konfigurasi `MEDIA_SCANNER` yang valid sebelum upload dapat dipakai.

`npm run media:cleanup-events` menghapus maksimal 100 upload Event yang lebih tua dari 24 jam dan belum terikat pada pendaftaran. Tidak menghapus berkas peserta terikat atau media tujuan lain. Jalankan berkala melalui mekanisme VPS yang akan ditetapkan pada tahap deployment; pekerjaan ini tidak memasang scheduler di server.

Migrasi `202610130008_events` bersifat tambahan. Jalankan `npm run db:migrate` dan `npm run db:generate` pada prosedur deployment yang sesuai. Tidak ada reset akun, sesi, anggota atau inventaris.

Migrasi tambahan `202610130009_event_replay_fences` menjaga permintaan lama yang sudah direkonsiliasi tidak dapat disimpan terlambat. Ekspor dibatasi 10.000 respons, 100 MiB data jawaban/definisi, 200.000 sel dan batas Excel 16.384 kolom. Jika terlalu besar, persempit filter tanggal/versi. Tidak ada respons yang diekspor sebagian tanpa pemberitahuan.

Jawaban gabungan yang melewati kapasitas satu sel Excel dilanjutkan pada kolom dengan label "lanjutan", tidak dipotong. Definisi pilihan panjang memiliki nomor bagian pada Kamus pertanyaan. Gabungkan bagian menurut urutannya bila membutuhkan string utuh.

Dua catatan minor: perubahan urutan pilihan saja masih menghasilkan ID pertanyaan baru saat save, sehingga peserta yang refresh perlu mengisi ulang jawaban tersebut; pencarian yang cocok pada lebih dari 10.000 respons satu event perlu kata lebih spesifik meskipun filter tanggal sempit.

Verifikasi UI dilakukan pengguna lewat screenshot. Tes HTTP/SSR tidak menggantikan penilaian tampilan di browser. Ada warning tracing pemindai native yang sudah ada pada build sebelumnya; audit paket standalone/source tetap bagian tahap deployment terpisah.
