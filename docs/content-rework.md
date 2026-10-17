# Rework konten organisasi — staging

## Penggunaan

- Anggota membuka Berita & pengumuman, menulis artikel lengkap, menambahkan gambar/caption/kredit dan tag, lalu mengirim ke redaksi.
- Multimedia dapat menyunting, mengembalikan dengan catatan, atau menerbitkan. Pengajuan yang sedang ditinjau tidak dapat diubah anggota. Revisi artikel terbit tidak menggantikan salinan publik sampai disetujui.
- Tag bersama: Gunung Hutan, SAR, Rock Climbing, Rafting, Caving, Konservasi. Tag galeri berlaku di tingkat album. Halaman divisi menampilkan berita dan album sesuai tag.
- Album menerima foto, MP4, atau tautan posting Instagram/TikTok publik yang mengizinkan penyematan. Pilih Media utama dan Highlight beranda. Video landscape menggunakan seluruh area media unggulan; portrait tetap memperlihatkan album berikutnya pada desktop. Pemutar berhenti memicu perpindahan carousel saat aktif.
- Foto maksimal 5 MB; MP4 maksimal 50 MB, 20 menit dan 4K. Server memeriksa container, codec dan dimensi setelah pemindaian. Video dimuat sesuai kebutuhan dan dilayani dengan byte ranges.
- Pembaca PDF: sampul tunggal, dua halaman desktop/satu halaman ponsel, thumbnail, nomor halaman, zoom, layar penuh, keyboard/swipe. EPUB memakai pembaca sebelumnya.
- Sampul event menjadi banner di atas formulir. Poster tetap pada informasi kegiatan.

## Deployment InterServer

Target perubahan hanya `WapalaTUP/website_wapala`, branch `staging`. Tarik kode dengan `git pull --ff-only origin staging` sebelum build. Jangan merge atau deploy main sebelum ACC.

**Database staging/main sama.** Backup melalui menu 5 sebelum deploy migrasi. Migrasi `202610170001_editorial_workflow` hanya menambahkan kolom dan indeks; tidak menghapus/mengganti kolom lama. Rollback kode tidak mengembalikan database.

Kolom `fields` tetap menyimpan struktur yang dapat dibaca/diedit main lama. Metadata baru disimpan di `contentMeta`, revisi belum disetujui di `draftFields`. Salinan publik tetap pada `fields` selama revisi. Bila main lama mengubah isi/gambar setelah rollback, metadata rich text/media yang sudah tidak sesuai diabaikan oleh versi baru agar perubahan lama tidak tertimpa tampilan usang.

Unggah MP4 memerlukan `ffprobe` (paket Ubuntu `ffmpeg`). Provisioning baru memasangnya. Server existing: `sudo apt-get update && sudo apt-get install -y ffmpeg`; verifikasi `ffprobe -version`. Jalur executable dapat ditentukan dengan `MEDIA_FFPROBE`. Tanpa alat ini unggahan video ditolak, bukan diterima tanpa pemeriksaan. Pengujian memakai fixture video pendek, bukan video milik pengguna.

## Pemeriksaan

Jalankan di VPS sesuai arahan operator: `npm run db:generate`, `npm test`, `npm run typecheck`, `npm run lint -- --max-warnings=0`, `npm run format:check`, `npm run build`. Setelah deploy periksa health, alur anggota → Multimedia → publik, filter tag, album landscape/portrait, PDF, dan sampul formulir event.

`scripts/content-integration.ts` adalah harness database terisolasi lokal yang sempat dipakai sebelum instruksi VPS-only. Harness menolak host nonlokal dan database tanpa akhiran `_test`. Jangan arahkan ke database produksi. Untuk pengujian di VPS gunakan database/schema terisolasi dengan izin yang sesuai, atau UAT melalui aplikasi staging dengan record uji yang jelas.

## Bahan divisi

Pengenalan dirangkum dari diktat WAPALA pada AnyFlip; ringkasan bukan salinan petunjuk teknis. Tautan sumber tampil di halaman divisi:

- Gunung Hutan: https://anyflip.com/sdvoe/ycgx/
- Rock Climbing: https://anyflip.com/sdvoe/vzzs/
- Caving: https://anyflip.com/sdvoe/sfgb/
- Rafting: https://anyflip.com/sdvoe/pldf/
- SAR: https://anyflip.com/sdvoe/vpaz/
- Konservasi: https://anyflip.com/sdvoe/syle/
