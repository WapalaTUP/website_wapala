# Revisi admin dan donasi — desain disetujui

## Tujuan dan batas tahap

Melanjutkan revisi frontend WAPALA berdasarkan `prd.md`, revisi percakapan, dan `docs/codegraph-map.md`. Hasil tahap ini adalah UI yang dapat diuji dengan data contoh, bukan autentikasi, pembayaran, atau operasi produksi. Tidak membaca/mengimpor dokumen pribadi Src otomatis, tidak mengunggah ke layanan eksternal, dan tidak mereset kredensial nyata.

## Pendekatan

Direkomendasikan: pisahkan model/utilitas kampanye, import, dan kepengurusan dari komponen admin besar, sambil mempertahankan store preview dan desain sekarang. Alternatif menambah semuanya ke Settings mempertahankan ketergantungan kampanye tunggal; langsung membangun backend melampaui checkpoint frontend yang sedang direvisi. Model preview dibuat dapat dimigrasikan ke server nanti, tanpa menjadikan mekanisme browser sebagai kontrol keamanan.

## Kampanye dan QRIS

- Tambahkan koleksi kampanye ber-ID tetap dan `campaignId` pada konfirmasi donasi. Migrasi data demo lama ke satu kampanye legacy tanpa menghapus donasi atau audit.
- Kampanye memuat judul, keterangan tujuan/penerima, sampul, foto QRIS, target, rekening/bank, kolaborator, tanggal mulai/selesai dan status draft/aktif/ditutup/arsip.
- Admin menyediakan daftar, tambah/edit, aktif/nonaktif, dan detail konfirmasi per kampanye. Total hanya menjumlah donasi terverifikasi kampanye itu. POH/Inventaris tidak mendapat izin kampanye.
- Publik memilih kampanye aktif, membaca keterangannya, melihat QRIS/rekening dan mengirim konfirmasi untuk kampanye tersebut. CTA Donasi muncul jika ada kampanye aktif. Identitas donatur tidak ditampilkan publik.
- Unggah QRIS menerima JPG/PNG/WebP maksimal 5 MB, dengan preview dan error. QRIS asli tidak dibuat atau ditebak. Jika belum ada QRIS/rekening, metode itu tidak ditawarkan.
- Marapi dan Banjir Demak hanya contoh berlabel demo; tidak dinyatakan sebagai kampanye nyata WAPALA.

## Import Anggota dan Inventaris

- Tombol import dan unduh template tersedia sesuai izin: POH/Super User untuk Anggota, Inventaris/Super User untuk Inventaris.
- XLSX dan CSV diproses lokal dengan dependensi yang sudah tersedia; pembaca XLSX dimuat saat diperlukan, bukan di Beranda.
- Tahap: pilih file → petakan kolom → preview dan validasi → konfirmasi penerapan. Tampilkan nomor baris, error wajib, tipe/nilai tidak valid, duplikasi internal dan konflik data yang ada.
- Identitas duplikasi: NIA anggota dan kode inventaris; NIM anggota menjadi pemeriksaan konflik tambahan. Kolom identitas diperlakukan sebagai teks agar nol depan tidak hilang.
- Default hanya menambah baris baru yang valid; konflik tidak menimpa data lama diam-diam. Jika ada error, penerapan diblokir sampai diperbaiki. Batasi ukuran/jumlah baris dan jangan menjalankan formula/makro.
- Template mengikuti field PRD; model inventaris yang belum memuat tipe/warna, sumber, tahun masuk dan foto harus diperluas dalam preview.
- Untuk tahap UI, gunakan file contoh fiktif. Beri peringatan sebelum file pribadi diproses: data preview tersimpan di browser, bukan penyimpanan produksi yang aman. Audit mencatat ringkasan impor, bukan isi sensitif seluruh spreadsheet.

## Kepengurusan dan akun

- Menu Reset periode kepengurusan hanya muncul dan dapat dibuka Super User dalam preview. Tahun kepengurusan berbeda dari periode OR; perubahan ini tidak mereset OR, kampanye, anggota atau stok inventaris.
- Wizard memilih periode baru, menampilkan dampak arsip dan pilihan akun, lalu meminta konfirmasi. Tidak ada penghapusan permanen.
- Kebijakan disetujui: arsipkan hanya peminjaman selesai (`Dikembalikan`) atau ditolak; bawa pengajuan/peminjaman belum selesai ke pengelolaan periode baru dengan periode asal tetap tercatat. Semua kode, item, kondisi, jaminan, denda dan riwayat dipertahankan. Jangan menganggap barang kembali akibat reset.
- Per akun admin/pengguna tersedia pertahankan password atau minta password baru. Default pertahankan. Reset Super User adalah tindakan terpisah agar tidak terkunci oleh operasi massal.
- Preview hanya mensimulasikan permintaan reset dan status wajib ganti; tidak menyimpan password nyata atau mengklaim session browser sebagai autentikasi aman. Hash password, token reset sekali pakai, autentikasi ulang, pencabutan sesi dan wajib ganti diterapkan pada backend nanti.
- Nama akun: `POH@wapala.org` (POH), `Logistik@wapala.org` (Inventaris), `Kerjasama@wapala.org` (Multimedia/Mulmed). Peran dan izin tetap dipisahkan dari alamat login. Tidak membuat mailbox/domain eksternal. Super User mempertahankan identitas preview sampai pemilik menetapkan akun produksi.

## Perapian UI Oprec dan admin

Pisahkan status/periode berjalan dari aksi membuat tahun baru. Filter periode dan ekspor berada dalam satu toolbar konsisten; panel kampanye menampilkan keterangan, status dan progres masing-masing. Pertahankan warna, tipografi, light/dark, tata letak responsif, label, fokus, modal konfirmasi dan empty/error/loading states.

## Verifikasi dan urutan

1. Migrasi multi-kampanye dan isolasi nominal/konfirmasi; UI publik/admin dan QRIS.
2. Parser/validasi/pratinjau import, lalu kedua menu dan template.
3. Model kepengurusan, wizard arsip, pilihan reset preview, akun dan perapian Oprec.
4. Uji migrasi tanpa kehilangan data, konflik import, nol depan, status pinjaman belum selesai, role Super User dan aktivasi CTA. Jalankan seluruh test, typecheck, lint, build, browser desktop/mobile dan sinkronkan CodeGraph.

Setelah UI terverifikasi, berhenti dengan pesan `Check UI!!!`. Backend belum dimulai. Pengguna menyetujui desain dan kebijakan pinjaman belum selesai pada 13 Oktober 2026.
# Approved user amendment — bank accounts and poster

During continuous execution, user requested multiple bank accounts per campaign (bank, textual number, recipient/holder), add/remove controls, and separate donation poster upload. Preserve legacy account data without inventing holder names; show poster intact and snapshot selected account on transfer confirmation. Subsequent user constraint prohibits browser operation: verify with tests and user screenshots. This extends the approved campaign scope; no production payment/backend work is authorized.

