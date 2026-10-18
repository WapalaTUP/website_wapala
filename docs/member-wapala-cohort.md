# Angkatan WAPALA pada data anggota

CSV anggota mendukung dua isian terpisah:

- `angkatan`: tahun masuk kuliah, misalnya `2024`.
- `angkatan_wapala`: nama angkatan organisasi, misalnya `WAPALA XX`. Opsional agar berkas lama tetap diterima.

Pemetaan otomatis mengikuti nama header tanpa membedakan kapital, spasi, tanda hubung, dan garis bawah. Urutan kolom CSV bebas. Form anggota, tabel admin/direktori, preview impor, template CSV, dan ekspor menyertakan angkatan organisasi.

## Deploy dan pemeriksaan di VPS

Migration `202610180002_member_wapala_cohort` menambah kolom `Member.angkatanWapala` dengan default teks kosong. Jalankan alur update biasa melalui `wapala.sh` (termasuk migration dan Prisma generate) sebelum menjalankan kode baru. Tidak ada penghapusan atau perubahan data lama.

Kolom terpisah menjaga JSON `Member.fields` serta payload koreksi tetap kompatibel dengan validator strict rilis sebelumnya pada database bersama. Koreksi anggota tidak menghapus angkatan organisasi. Penyimpanan dari klien lama yang belum mengirim field baru mempertahankan nilainya.

Pengujian lokal tidak dijalankan sesuai instruksi. Di VPS, setelah generate Prisma, jalankan:

```sh
node --conditions=react-server --import tsx --test tests/member-wapala-cohort.test.ts
npm run typecheck
```

Lalu uji impor CSV, lihat kedua angkatan pada preview/tabel, ubah profil, dan ekspor. Impor tetap hanya menambah anggota baru: NIA/NIM yang telah ada di database tidak diperbarui otomatis.
