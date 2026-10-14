# Branch workflow

- `main`: kode aplikasi, konfigurasi build, migrasi, pengujian, dan panduan
  operasional. Checkout branch ini pada VPS.
- `staging`: integrasi serta pengujian perubahan sebelum dipromosikan ke `main`.
- `Agents`: arsip instruksi AI, catatan perubahan, konfigurasi CodeGraph,
  rencana/spec Superpowers, serta artefak kerja Figma. Branch ini mempertahankan
  snapshot kode ketika pemisahan dilakukan, tetapi bukan sumber deployment.

## Alur perubahan

Mulai perubahan aplikasi dari `staging`, jalankan pemeriksaan yang relevan,
lalu tinjau diff sebelum mempromosikan commit yang disetujui ke `main`.
Push revisi aplikasi setelah mendapat approval pengguna.

Jangan merge branch `Agents` secara keseluruhan ke `main` atau `staging` karena
akan memasukkan kembali file pendukung AI. Jika ada commit aplikasi yang perlu
diambil dari branch tersebut, pilih commit kode melalui cherry-pick dan tinjau
daftar file sebelum merge.

File agent yang dibuat ulang oleh alat lokal diabaikan `.gitignore` pada branch
aplikasi. `.gitignore` tidak melarang file yang dipaksa masuk oleh merge atau
`git add -f`; reviewer tetap harus memeriksa daftar file rilis.

## Checkout pada VPS

```sh
git clone --branch main --single-branch https://github.com/hulwanulazka-companion/wapala_dev.git
```

Pemisahan ini membersihkan isi checkout branch, bukan menghapus file dari
riwayat Git. Arsip AI tetap dapat dipulihkan dari branch `Agents` dan commit lama.
Gunakan panduan deployment Ubuntu untuk instalasi dependency, migrasi, build,
dan aktivasi service.
