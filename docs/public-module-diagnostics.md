# Pemeriksaan peminjaman publik dan upload galeri

13 Oktober 2026. Permintaan pengguna: cek alat yang ada di admin tetapi kosong di halaman peminjaman, serta galeri yang gagal mengunggah foto. Pemeriksaan read-only, tanpa browser.

## Alat publik tidak muncul

Database lokal memiliki 193 alat tidak diarsipkan. 4 ditandai tersedia untuk pengunjung. `publicState()` mengirim 193 item katalog pada `publicEquipment`, sedangkan `equipment` sengaja kosong untuk tidak mengekspos jumlah stok, lokasi penyimpanan, dan metadata admin.

`src/components/forms.tsx::LoanForm` masih menggunakan `state.equipment` untuk katalog, pilihan, kategori dan ringkasan. Karena itu alat terlihat di admin tetapi daftar publik kosong. Ini bukan kehilangan data impor atau kesalahan checkbox ketersediaan.

Form ini juga masih mengirim melalui `updateStore` yang ditolak dalam mode backend. Perbaikan lengkap perlu menggunakan DTO katalog publik untuk display dan endpoint server untuk pengajuan/tracking, bukan menyalin stok admin ke state publik. Tidak menambahkan nilai jumlah stok palsu atau mengembalikan fallback demo.

Status 14 Oktober: katalog, kategori, pilihan dan ringkasan sekarang membaca `publicEquipment` dalam mode backend. Input jumlah memakai `maxQuantity` dan dinonaktifkan untuk alat tidak tersedia. Tidak ada fallback ke inventaris privat. Pengiriman/tracking masih perlu integrasi endpoint publik sebelum ZIP release; perbaikan katalog bukan klaim seluruh alur peminjaman selesai.

## Foto galeri gagal diunggah

Upload cover/album di `components/backend/records.tsx` menggunakan `uploadMedia(file, "content", csrfToken)`, tujuan yang sesuai policy server. Tes pemindai native lokal menghasilkan kode `SCANNER_UNAVAILABLE`. `MEDIA_SCANNER` tidak dikonfigurasi dan `clamscan` tidak ditemukan. Cabang proses gagal di scanner memakai pesan DomainError default sehingga UI menampilkan "Permintaan tidak dapat diproses."

Server sengaja fail-closed. Foto tidak didaftarkan sebelum pemindaian keamanan berhasil. Foto tersimpan, checkbox publik dan field tanggal bukan penyebab kegagalan ini.

Status 14 Oktober: ClamAV portable 1.4.6 lokal disiapkan di `.local/clamav` tanpa service Windows/global install. SHA256 ZIP cocok dengan digest rilis resmi GitHub (`57b6fd1d60cd87bafe800f97407ecdef0576d36b3900b8b7abcfbbabe88295fd`). FreshClam memperbarui dan menguji database main/daily/bytecode lengkap. `scripts/backend-dev.ts` memuat `.local/scanner.env`; scanner mendukung `MEDIA_SCANNER_DATABASE` absolut dan normalisasi path Windows. Error startup/timeout sekarang memberikan pesan operasional, tetap fail-closed.

Gambar normal diterima oleh scanner file native (~11 detik cold start). Uji EICAR melalui file/stdin clamscan Windows menghasilkan exit 2 (tidak diklaim terdeteksi lewat jalur aplikasi). Pemindai ClamAV yang sama mendeteksi EICAR melalui INSTREAM daemon loopback untuk smoke test; daemon uji dihentikan setelah tes. Tidak menonaktifkan antivirus Windows atau membuat pengecualian. Native HTTP test menggunakan database terisolasi: upload content dan event-poster → scannedAt tersimpan → file WebP dapat dibaca → referensi diterima saat menyimpan galeri/Event. File media uji dibersihkan berdasarkan UUID yang dihasilkan sendiri.

Verifikasi: frontend75/75; unit26/26; PostgreSQL/HTTP66/66 termasuk native scanner opt-in. Typecheck/lint lulus. Native suite dijalankan dengan `WAPALA_TEST_NATIVE_SCANNER=1`, `MEDIA_SCANNER` dan `MEDIA_SCANNER_DATABASE` eksplisit; runner tidak otomatis membaca scanner.env. Server dev sudah restart, akun/data pengguna tidak diubah. Build release baru belum dijalankan dalam checkpoint ini.

Judul Event diperbaiki menjadi newline JavaScript nyata, bukan literal `\\n`, memakai CSS pre-line yang sudah ada. SSR/HTTP memverifikasi katalog tidak kosong dan judul tidak menampilkan escape literal. Browser tidak dipakai; penerimaan visual tetap lewat screenshot pengguna.

Deployment tetap VPS 2 GB sesuai jawaban pengguna. Daemon smoke Windows memakai sekitar956 MiB working set; angka ini bukan benchmark Ubuntu dan bukan bukti seluruh stack muat 2 GB. Uji memori Linux dan batas scanner tetap gate sebelum deployment, tanpa mengurangi database signature.

Pemeriksaan ini tidak mengubah alat, password, akun, berkas galeri atau konfigurasi server. Data sumber/hasil impor tetap tersimpan.
