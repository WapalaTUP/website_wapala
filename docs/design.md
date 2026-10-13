# WAPALA — desain Tahap 1

Sumber kebutuhan: ../prd.md, khusus Tahap 1. Dibangun lokal di Dev_Website dengan Next.js App Router dan TypeScript. Semua data operasional adalah contoh fiktif, disimpan pada browser untuk demonstrasi interaksi. Aplikasi belum mempunyai autentikasi atau backend produksi.

## Arah visual

Fotografi alam menjadi elemen paling kuat. Header putih menampilkan logo resmi pada panel putih. Komposisi beranda membuka dengan foto lanskap lebar, headline kiri, kemudian pengantar, divisi, jurnal, galeri, dan CTA kontekstual. Tidak menggunakan metrik organisasi yang belum diverifikasi.

Warna: paper #ffffff, ink #182422, sky #1064c5 (biru logo), field #286441 (turunan hijau logo untuk kontras AA), trail #c52d2c (merah CTA), muted #f2f5f3. Logo tetap memakai warna asli. Tema gelap memakai #131e1b dan teks #f5f8f6. Radius 4–8px, bayangan hanya untuk panel overlay. Barlow Condensed 600/700 untuk headline; Manrope 400/500/600/700 untuk isi.

## Struktur dan interaksi

- Publik: beranda, profil, divisi, berita/announcement dan detail, galeri dan album, buku dengan viewer, kontak, peminjaman bertahap, status kode, invoice, donasi, OR dan revisi.
- Admin: /wapala untuk login demo; /admin/[modul] untuk anggota, konten, galeri, buku, OR, inventaris, peminjaman, donasi, pengguna, pengaturan, arsip, audit. Pemilih role hanya untuk review UI; menu mengikuti izin. Tidak ada login publik.
- State demo: feature flags OR/donasi, pengajuan dan perubahan status, revisi OR, arsip, formulir edit, ekspor. Data anggota sebenarnya tidak disalin ke website.
- Viewer buku PDF menggunakan canvas, kontrol halaman/zoom, tanpa unduh. EPUB reader disediakan untuk sumber EPUB setelah tersedia. Salinan sumber lokal tetap belum terlindungi; kontrol akses media termasuk Tahap 2/3.

## Pemeriksaan

Typecheck, lint, production build, unit test aturan status/validasi/izin, uji browser mobile/desktop untuk tema, navigasi, filter, form, role, invoice dan buku. Konten sampel dan foto stok ditandai pada panduan review. Tidak ada publikasi eksternal.
