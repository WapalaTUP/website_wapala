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

## Perbaikan penyimpanan video album (18 Oktober 2026)

Migration `202610180003_album_video_media` memperluas constraint Media agar MP4 berpurpose `content-video` bisa tersimpan sebagai media publik. Migration sebelumnya hanya mengizinkan ekstensi WebP/PDF/EPUB dan media publik gambar WebP, sehingga video yang lolos pemeriksaan akan gagal saat INSERT (HTTP 500). Foto dan buku lama dipertahankan; PDF/EPUB tetap tidak boleh menjadi media publik.

Deploy lewat alur update `wapala.sh` dengan migration aktif (jangan gunakan `WAPALA_SKIP_MIGRATE=1`). Tidak ada perubahan data atau kebutuhan unggah ulang foto lama. Setelah deploy, unggah ulang video yang sebelumnya gagal. Pemeriksaan `ffprobe` dan pemindaian keamanan tetap berlaku.

Tes PostgreSQL ditambahkan pada `tests/media-video-constraints.test.ts`. Tes memakai database khusus berakhiran `_test` melalui `MEDIA_TEST_DATABASE_URL`, menyalin migration ke tabel sementara, mereproduksi penolakan MP4 pada skema lama, lalu memeriksa penerimaan MP4 dan penolakan media publik yang tidak diizinkan setelah migration baru. Seluruh transaksi di-rollback; tabel aplikasi tidak disentuh. Jalankan di VPS dengan env test yang telah disiapkan:

```sh
node --conditions=react-server --import tsx --test tests/media-video-constraints.test.ts
```

Tanpa `MEDIA_TEST_DATABASE_URL`, tes ini dilewati. Tes/build tidak dijalankan di komputer lokal sesuai instruksi pengguna.

## Autoplay album

- MP4 unggahan mencoba `play()` dengan suara saat minimal 25% pemutar terlihat dan tab aktif. Jika browser menolak dengan `NotAllowedError`, pemutar mencoba sekali lagi tanpa suara; kontrol volume/play tetap tersedia. Kesalahan sumber video tidak memicu percobaan mute.
- TikTok dan YouTube dimuat otomatis saat terlihat dengan parameter autoplay. TikTok memakai `muted=0`; YouTube tidak dimute oleh aplikasi. Browser atau preferensi pemutar tetap dapat memblokir suara sebelum interaksi.
- Instagram dimuat otomatis, tetapi pemutaran tetap memakai tombol Play pada embed Instagram. Tidak ada parameter autoplay/unmute yang dipaksakan pada iframe Instagram.
- Video dijeda dan embed ditutup saat keluar layar atau tab tidak aktif. Preferensi reduced motion menonaktifkan pemutaran otomatis; pemutaran manual tetap tersedia. Preview editor dan panel album berikutnya tetap manual.

Referensi: [kebijakan autoplay browser](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay), [parameter YouTube](https://developers.google.com/youtube/player_parameters), [pemutar TikTok](https://developers.tiktok.com/docs/en/embed-player).

Tes kebijakan pemutaran ditambahkan pada `tests/album-autoplay.test.ts`, belum dijalankan lokal. Di VPS jalankan `node --conditions=react-server --import tsx --test tests/album-autoplay.test.ts`, lalu periksa MP4, TikTok, YouTube, Instagram, scroll keluar layar, tab latar, reduced motion, serta preview editor di browser. Perubahan autoplay ini tidak memerlukan migration baru.

## Kompatibilitas ffprobe Hostdata (FFmpeg 4.4)

Reproduksi di Hostdata menunjukkan `No match for section 'stream_side_data'`. Binary Ubuntu 22.04/FFmpeg 4.4 tidak menerima alias section itu sehingga proses berhenti sebelum membaca video. Validator menggunakan nama section bersama `side_data=rotation`, yang juga tersedia pada versi baru. Pembacaan orientasi, codec, dimensi, durasi, batas input/output, timeout, dan pembatasan protokol tetap berlaku. Tidak perlu upgrade paket melalui repository tambahan.

Perbaikan kode ini memerlukan build/deploy baru; tidak ada migration. Tes fixture MP4 dan rotasi yang sudah ada mencakup jalur ini, tetapi belum dijalankan lokal sesuai instruksi pengguna. Jika checkout tempat menjalankan test belum memiliki `node_modules`, jangan menganggap kegagalan `Cannot find package 'tsx'` sebagai kegagalan video. Pengelola dapat memeriksa kompatibilitas CLI di VPS tanpa instalasi npm, dari root checkout yang memiliki fixture:

```sh
sudo -u wapala /usr/bin/ffprobe \
  -v error -threads 1 -max_alloc 67108864 \
  -protocol_whitelist pipe \
  -probesize 52428800 -analyzeduration 10000000 \
  -show_entries 'stream=codec_type,codec_name,width,height:side_data=rotation:format=format_name,duration' \
  -of json pipe:0 \
  < src/server/media/fixtures/album-video.mp4
```

Harus keluar JSON berisi video `h264`, ukuran `160 × 120`, dan durasi positif. Untuk fixture `album-video-portrait.mp4`, periksa `side_data_list` memuat rotasi sehingga validator menghasilkan orientasi portrait. Pemeriksaan CLI tidak menggantikan uji upload melalui aplikasi setelah deploy, terutama karena service systemd memakai sandbox tersendiri.

Referensi: [section ffprobe](https://ffmpeg.org/ffprobe.html#Main-options), [definisi section pada FFmpeg 4.4](https://github.com/FFmpeg/FFmpeg/blob/n4.4/fftools/ffprobe.c).
