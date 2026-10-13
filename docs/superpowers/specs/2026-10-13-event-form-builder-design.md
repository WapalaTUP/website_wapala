# Event WAPALA dan formulir pendaftaran dinamis

Status: spesifikasi untuk ditinjau pengguna. Belum ada implementasi atau perubahan database.

## Tujuan dan kesepakatan

WAPALA dapat membuat beberapa event independen, masing-masing dengan poster, keterangan, formulir dan daftar pendaftar. Tampilan publik mengikuti pola Donasi. Editor mengikuti interaksi Google Forms, tetap memakai identitas visual WAPALA. Google Forms menjadi referensi pengalaman penggunaan, bukan integrasi akun Google atau janji menyalin semua fitur produk Google.

Semua pertanyaan peserta opsional secara default. Admin dapat mengaktifkan Wajib per pertanyaan. Nama Lengkap, NIM, Program Studi, Nomor WhatsApp Aktif, Status Saat Ini dan sumber informasi kegiatan merupakan template yang dapat diedit, bukan kolom tetap. Event tidak terbatas pada Camp Fire atau peserta mahasiswa.

Persetujuan percakapan: pengguna meminta editor seperti Google Forms, ekspor hasil Excel dan memberikan instruksi GAS. Dokumen ini merinci desain sebelum implementasi.

## Pilihan pendekatan

1. **Disarankan: formulir native WAPALA dengan versi tersimpan di PostgreSQL.** Terintegrasi dengan sesi, izin admin, media dan audit yang sudah ada. Tidak memerlukan akun Google. Jawaban lama dapat dipertahankan ketika formulir berubah.
2. Embed Google Forms: lebih cepat, tetapi pengelolaan dan data peserta terpisah, kendali tampilan dan izin tidak mengikuti portal.
3. Library form-builder lengkap: mengurangi pekerjaan editor, tetapi menambah dependency dan tetap memerlukan validasi server, versi dan pemetaan jawaban sendiri.

Pendekatan pertama dipilih untuk menjaga data peserta dan pengelolaan tetap di WAPALA. Tidak mengubah Donasi/OR menjadi formulir dinamis dalam pekerjaan ini.

## UI admin

Menu Event di portal admin. Default izin mengikuti Kampanye: Super User dan Kerjasama/MULTIMEDIA. POH dan Logistik tidak memperoleh akses peserta Event secara otomatis. Izin diperiksa server, bukan sekadar menyembunyikan menu.

Daftar event menampilkan judul, status, jadwal bila diisi dan jumlah peserta. Aksi: tambah, edit, lihat respons, buka/tutup, arsipkan. Tidak ada penghapusan permanen respons dalam tahap ini.

Editor berupa halaman khusus, bukan dialog panjang:

- Tab **Pertanyaan**, **Respons**, **Pengaturan**.
- Judul/deskripsi formulir, poster dan cover opsional. Judul event diperlukan untuk identifikasi pengelola, berbeda dari pertanyaan peserta yang semuanya dapat opsional.
- Pertanyaan terpilih dapat diedit langsung: judul, petunjuk, tipe, pilihan, validasi dan sakelar Wajib.
- Toolbar tambah pertanyaan, tambah bagian, duplikasi, hapus dan preview.
- Reorder dengan drag dan tombol naik/turun yang berfungsi melalui keyboard dan mobile.
- Dropdown tipe jawaban; pilihan dapat ditambah/dihapus/diurutkan. Label Status dan sumber informasi sepenuhnya bebas.
- Draft disimpan eksplisit dengan indikator perubahan belum tersimpan. Simpan draft tidak mengganti formulir publik. Publikasikan menjadi versi aktif dan membutuhkan konfirmasi dampak bila sudah ada respons.
- Preview desktop/mobile menggunakan renderer yang sama dengan formulir publik, tetapi tidak membuat respons nyata.

Tipe awal: teks singkat, paragraf, angka, email, tanggal, waktu, pilihan tunggal, checkbox, dropdown, unggah berkas, skala linear, grid pilihan tunggal, grid checkbox dan bagian. Opsi Lainnya tersedia pada pilihan tunggal/checkbox. Validasi sesuai tipe meliputi panjang teks, rentang angka/tanggal dan jumlah pilihan. Tidak menerima JavaScript/HTML atau regex bebas dari admin.

Bagian dan pertanyaan boleh memiliki kondisi tampil berdasarkan jawaban pilihan yang muncul sebelumnya. Kondisi hanya mengacu ke ID pertanyaan/opsi yang valid, tidak memiliki siklus dan tidak melakukan lompat arbitrer. Pertanyaan tersembunyi tidak dianggap wajib dan jawabannya tidak disimpan.

## Tampilan publik

Menu Event di kanan Kontak bersama Open Recruitment dan Donasi, menggunakan hierarki visual yang sama. Tombol tampil hanya bila ada event aktif yang dipublikasikan admin. Event tetap mempunyai rute daftar sendiri `/event` dan detail `/event/[id]`.

Daftar berupa kartu poster, judul, deskripsi singkat dan jadwal bila tersedia. Tidak menampilkan identitas atau jumlah jawaban peserta secara publik. Detail menampilkan poster dengan rasio asli, keterangan kegiatan dan tombol Daftar. Formulir mengikuti urutan/bagian yang dipublikasikan. Formulir yang semua pertanyaannya opsional tetap dapat dikirim tanpa jawaban.

Event dapat memiliki lokasi, waktu kegiatan, batas waktu pendaftaran dan kuota; semuanya opsional. Draft/arsip tidak terbuka publik. Ditutup tetap dapat dibaca melalui detail yang pernah dipublikasikan, tetapi tidak menerima pendaftaran. Server menjadi otoritas untuk status, jadwal, kuota dan validasi.

Pendaftaran tidak memerlukan login Google/WAPALA. Tanpa field identitas wajib, tidak mungkin menjamin satu orang hanya mendaftar sekali. Sistem mencegah kirim ulang dari permintaan yang sama dengan kunci idempotensi, bukan menebak identitas peserta berdasarkan IP.

## Data dan perubahan formulir

Model terpisah dari Campaign dan RecruitmentPeriod:

- `Event`: metadata, status, version untuk optimistic concurrency, referensi versi formulir aktif, jadwal dan kuota opsional.
- `EventFormRevision`: versi immutable berisi definisi bagian/pertanyaan/opsi yang tervalidasi, nomor versi, waktu dan pembuat. Draft dapat diedit terpisah; revision dipublikasikan tidak ditimpa.
- `EventRegistration`: UUID, kode pendaftaran, event, revision yang dijawab, waktu penerimaan server, kunci idempotensi dan jawaban JSON terstruktur berdasarkan ID pertanyaan/opsi.
- Media peserta terikat pada registration dan private; poster/cover merupakan media publik terdaftar.

Judul pertanyaan bukan primary key. ID tetap ketika urutan, judul atau petunjuk berubah. Perubahan tipe atau opsi yang mengubah makna membuat ID baru; pertanyaan lama hanya dipensiunkan dari versi berikutnya. Menghapus dari editor tidak menghapus respons lama.

Jika form publik berubah ketika peserta sedang mengisi, server mengembalikan konflik versi sebelum menyimpan, UI mempertahankan jawaban lokal dan meminta meninjau form terbaru. Tidak diam-diam memindahkan jawaban ke pertanyaan lain. Pengiriman ulang dari request sukses mengembalikan kode yang sama, tidak mengurangi kuota dua kali.

Kuota dan penerimaan respons diperiksa dalam transaksi dengan locking pada event sehingga permintaan paralel tidak melebihi kuota. Event terikat secara eksplisit pada setiap respons; tidak ada campuran peserta lintas event.

## Respons dan Excel

Tab Respons menyediakan ringkasan jumlah, daftar paginated, pencarian nomor/jawaban teks, filter versi dan tampilan detail sesuai label pada versi yang benar. Respons peserta hanya tersedia untuk admin Event.

Ekspor server `.xlsx` menggunakan ExcelJS yang sudah ada, satu baris per pendaftaran. Kolom awal: kode, waktu pendaftaran WIB dan versi formulir. Kolom selanjutnya adalah gabungan ID pertanyaan dari versi yang memiliki respons, menurut urutan kemunculan. Pertanyaan dipensiunkan tetap diekspor. Label yang berubah dicatat dalam sheet Kamus pertanyaan; judul kolom memuat ID pendek untuk membedakan judul sama. Pilihan diekspor sebagai teks label pada revision peserta, bukan label versi terbaru. Checkbox/grid diserialisasi terbaca tanpa kehilangan pasangan baris/pilihan.

NIM, WhatsApp, kode dan semua jawaban teks tetap sel bertipe string, termasuk nol awal dan teks yang dimulai `=`, `+`, `-` atau `@`; tidak dibuat menjadi formula. Angka yang memang berasal dari field angka disimpan numerik. Tidak membuat URL unduh media privat permanen atau memasukkan token akses ke Excel; ekspor berisi nama/ID berkas, unduh tetap melalui portal berizin.

Ekspor memakai filter daftar yang sama, snapshot konsisten, batas batch/memori dan hasil lengkap. Jika melebihi batas ekspor sinkron server, tampilkan alasan spesifik dan minta filter rentang waktu; jangan mengekspor sebagian tanpa pemberitahuan. Header dibekukan, filter dan lebar kolom ditata. Tidak membuat data peserta contoh sebagai seed produksi.

## Keamanan dan batas teknis

Gunakan sesi database HttpOnly, pemeriksaan izin dan freshness, CSRF/Origin untuk mutation admin, audit tanpa payload jawaban pribadi, validasi schema ketat dan Prisma. Public submit memakai token formulir bertanda tangan, Origin tepercaya, throttling dan honeypot. Token tidak menggantikan otorisasi; tidak menyediakan endpoint daftar respons publik.

Batas operasional awal: 200 pertanyaan per event, 200 opsi per pertanyaan, panjang teks jawaban maksimal 10.000 karakter dan body JSON maksimal 1 MiB. Batas ini melindungi server 2 GB, bukan membatasi jenis kegiatan. Admin melihat pesan limit yang jelas. Validasi shared dipakai editor/preview/server, namun server tetap menentukan penerimaan akhir.

Unggah berkas peserta dibatasi JPG/PNG/WebP/PDF maksimal 5 MB per berkas, maksimal satu berkas per pertanyaan. Tipe lain tidak diterima tahap awal. Media wajib dipindai, kepemilikan upload sementara diperiksa dan berkas hanya terikat setelah transaksi berhasil. Endpoint private memeriksa izin setiap akses; file yatim dibersihkan aman. Scanner tetap fail-closed: bila ClamAV tidak tersedia, unggah ditolak dengan pesan jelas. Kondisi development saat ini scanner native belum diverifikasi; jangan mengklaim upload siap produksi tanpa tes nyata.

Tidak menambahkan pembayaran, tiket berbayar, QR check-in, sertifikat, email/WhatsApp otomatis, integrasi Google atau revisi peserta lewat link pada tahap ini. Fitur-fitur itu membutuhkan kebutuhan dan otorisasi terpisah.

## Integrasi yang ditemukan melalui CodeGraph CLI

`src/components/backend/admin-shell.tsx` dan admin catch-all untuk modul/izin; `src/components/shell.tsx` dan public catch-all untuk navigasi/rute; `src/server/auth/policy.ts` untuk izin; pola `src/server/domains/campaigns.ts` untuk CRUD, version, transaksi dan audit; `src/server/public-data.ts` untuk DTO publik; media storage untuk purpose, visibility dan binding. Domain Event tetap terpisah agar Donasi dan OR tidak berubah makna.

Migrasi hanya menambah tabel/relasi yang dibutuhkan. Tidak mereset database, password, sesi, anggota atau inventaris yang sudah ada. Discovery CLI memiliki indeks existing up to date pada awal pekerjaan. Tidak ada Git repository yang dapat dipakai commit; dokumen disimpan lokal.

## Arah visual

Pertahankan palet, Manrope untuk kontrol dan Barlow Condensed untuk judul dari WAPALA. Editor memakai kanvas pertanyaan dengan satu panel aktif dan toolbar kontekstual, bukan dekorasi baru di setiap kartu. Label/input sejajar, kontrol penuh pada mobile, focus keyboard terlihat, dark/light konsisten. Interaksi mengikuti Google Forms tetapi logo, warna dan copy WAPALA. Tidak membuka browser; penilaian visual berikutnya melalui screenshot pengguna dan pengujian struktur/responsif.

## Bukti penerimaan yang diperlukan

- Unit: semua tipe dan field opsional/wajib, pilihan/ID, cabang, validasi dan batas payload; tidak wajib pada pertanyaan tersembunyi.
- Unit/UI: editor, duplicate/reorder/delete/preview, peringatan perubahan draft, alignment dan akses keyboard.
- PostgreSQL/HTTP: RBAC/CSRF/freshness, status/jadwal, response privacy, stale revision, konflik admin, snapshot lama, atomic quota, idempotensi dan pemisahan event.
- Media: batas format/ukuran, kepemilikan, scanner menolak/timeout, akses private, binding dan cleanup tanpa kehilangan berkas sah.
- XLSX: buka kembali workbook hasil ekspor, jumlah baris/kolom, nol awal, formula injection, label historis, field dipensiunkan, filter dan hasil kosong.
- Regression: suite frontend/backend/integrasi existing, typecheck, lint dan build. Jangan mengklaim deployment selesai hanya karena tes lulus.

Setelah spesifikasi disetujui, tulis rencana implementasi bertahap dan tinjau metode eksekusi sebelum menulis kode produk. Setelah implementasi dan verifikasi, beri checkpoint **Check UI!!!**.
