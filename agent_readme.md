# Catatan riwayat kerja agent (checkpoint UI)

> **File ini adalah arsip riwayat untuk agent/AI, bukan dokumentasi proyek.**
> Isi di bawah adalah snapshot checkpoint tahap UI sebelum backend dibangun, dipertahankan apa adanya (ada informasi yang sudah kedaluwarsa, mis. "tahap backend belum dimulai" — backend kini selesai).
> Untuk gambaran proyek saat ini, lihat `README.md`. Untuk kebijakan deployment, lihat `docs/`.

---

# WAPALA — checkpoint UI

Frontend lokal berada di http://127.0.0.1:3000. Jalankan `npm run dev` dari folder ini untuk melanjutkan preview.

Portal demo: `/wapala`, email `demo@wapala.id`, password `wapala-demo`. Role hanya mengatur UI, bukan keamanan produksi. Data formulir tersimpan di browser: gunakan data fiktif, khususnya untuk kontak dan riwayat kesehatan.

## Revisi yang tersedia

- Navigasi tunggal, Beranda eksplisit, OR dan Donasi di kanan Kontak hanya ketika aktif, kemudian sakelar tema.
- Hero galeri 10 foto terbaru serta highlight admin, rasio asli, pergantian lima detik, pratinjau foto, dan pause ketika di luar viewport.
- Slideshow momen dari lima kategori berbeda dengan dua foto bertingkat.
- Profil 21 angkatan, empat divisi, dan Maps Sekretariat sesuai sumber aktif.
- Reader PDF dua halaman desktop, satu halaman mobile; halaman dirender seperlunya.
- OR mengikuti field referensi yang diberikan, ekspor berlabel, satu periode per tahun. Jawaban peserta asli tidak diimpor ke frontend.
- Kampanye & donasi terpisah di admin.
- Invoice PDF A4 landscape berisi dua salinan A5, kop dua logo, watermark, QR, garis potong, dan pagination/lampiran jika isi panjang. Gunakan PDF untuk cetak 100%, bukan screenshot halaman.

## Verifikasi

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

Tahap backend belum dimulai. Ketentuan impor awal, bootstrap Super User, dan pemisahan data mock ada di `docs/backend-handoff.md`. Ini checkpoint untuk review UI, bukan rilis produksi. Lima advisori `braces` di rantai ESLint development belum memiliki patch kompatibel; audit dependency produksi bersih pada pemeriksaan terakhir.
