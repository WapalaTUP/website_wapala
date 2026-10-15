# Perubahan inisialisasi Vercel — 16 Oktober 2026

## Cakupan

- Branch `vercel` saja; tidak merge/push ke `main` repository asal atau mengubah
  aplikasi/database produksi VPS.
- `INITIAL_SETUP_TOKEN` server-side dapat dipakai melalui alur login yang ada.
  Tidak membaca `.env.secret.token` otomatis dan tidak membuat password default.
- Hash token didaftarkan saat akses konteks login/bootstrap pertama, dengan
  batas 30 menit. Permintaan berulang tidak memperpanjang masa berlakunya.
- Rotasi tidak menimpa token aktif. Sidik token terdahulu mencegah token
  kedaluwarsa diaktifkan lagi. Tidak menyimpan nilai token asli di database.
- Setelah akun dibuat, hash aktif dan expiry dihapus secara atomik. Status
  selesai atau keberadaan Super User menutup instalasi meski secret berubah.
- Migrasi additive `202610160002_environment_bootstrap_token` menambahkan daftar
  sidik token pada `BootstrapState`; wajib diterapkan sebelum versi ini dijalankan.
- README memuat persiapan secret, instalasi, expiry/rotasi, penghapusan secret,
  dan perbedaan prosedur Vercel dengan VPS. Alur token CLI tetap tersedia.

## Verifikasi

- Regresi diamati sebelum implementasi: 4 tes bootstrap lama lulus dan 5 tes
  environment gagal karena dukungan environment belum ada.
- Sesudah implementasi: 16 tes integrasi bootstrap/login lulus pada PostgreSQL
  sementara terisolasi melalui SSH, termasuk pemanggilan endpoint auth dengan
  CSRF, token salah, expiry/rotasi/reuse, race, audit rollback, dan login.
- Tes umum: 98 lulus; tes backend non-integrasi: 42 lulus, keduanya melalui SSH.
- Typecheck seluruh proyek lulus melalui SSH. Lint selesai dengan 0 error dan
  7 warning `_obsoleteVerifier` pada file public-forms/handler lama yang tidak
  diubah dalam revisi ini. Tidak mengklaim lint bebas warning.
- Database dan role tes sementara dihapus setelah pengujian. Tidak menjalankan
  reset, migrasi, atau perubahan akun pada database produksi.
- Full build/deployment Vercel dan seluruh suite integrasi fitur lain bukan
  bagian verifikasi ini. Upload Blob/scanner/impor tetap pekerjaan terpisah;
  perubahan token bukan klaim kesiapan produksi keseluruhan aplikasi.
