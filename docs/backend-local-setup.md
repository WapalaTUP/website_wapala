# Backend lokal — tahap 2A

Target produksi tetap Ubuntu tanpa Docker. Tidak ada perubahan VPS pada pengerjaan lokal.

Gunakan Node.js 24 dan PostgreSQL native. Buat database development `wapala` dan database terpisah `wapala_test`. CLI/service PostgreSQL belum terdeteksi pada pemeriksaan awal; izin setup instance project-local telah ditanyakan, belum diasumsikan.

Salin `.env.example` ke `.env` sendiri, ganti DATABASE_URL/TEST_DATABASE_URL dan SECURITY_KEY di perangkat, jangan kirim secrets ke chat atau commit. Script membaca `.env` lokal hanya di server/CLI. APP_URL adalah origin tanpa path/query. Production memakai HTTPS, EMAIL_MODE=smtp dan WAPALA_MODE=backend. SMTP sink hanya development/test. Formulir publik dilindungi CSRF same-origin, cookie pemilik form HttpOnly, dan throttle persisten per IP/pemilik; tidak ada layanan verifikasi pihak ketiga.

Urutan: `npm ci`, `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`. Seed tidak membuat akun/password demo. Build tidak menjalankan migrasi atau impor. Jangan pakai `prisma db push` untuk produksi.

`npm test` memeriksa antarmuka dan kontrak frontend; `npm run test:backend` unit server; `npm run test:backend:integration` membutuhkan PostgreSQL nyata, hanya database `_test` dan schema per-run yang terisolasi. Kegagalan prasyarat bukan test yang dilewati lalu diklaim lulus.

## PostgreSQL development yang disetujui

Instance portable Windows memakai binary PostgreSQL 18.6 dari halaman resmi EDB, di `.local/postgres/bin-dist`. Data cluster persisten di `.local/postgres/data`, hanya bind `127.0.0.1:54329`; port awal 55432 dicadangkan Windows dan tidak dipakai. Tidak ada service Windows/akses VPS. `npm run db:local` menyalakan instance yang sama tanpa mereset data. Credential development acak ada di `.local/backend.env`, tidak ditampilkan atau dikomit.

CLI Prisma/seed membaca `.env` terlebih dahulu, lalu fallback `.local/backend.env` hanya nonproduction, tanpa menimpa environment proses. `npm run dev` membaca `.env.local`, `.env`, lalu `.local/backend.env` dengan environment proses tetap prioritas. Produksi tidak memakai helper portable Windows: operator memasang PostgreSQL native dan memberikan environment aplikasi melalui systemd.

## Bootstrap, login dan pemulihan

Setelah migration/seed, jalankan `npm run auth:bootstrap-token` sendiri pada terminal perangkat/server; token hanya tampil ke operator, berlaku 30 menit. Masukkan token di `/wapala`, buat password Super User. Login `superuser@wapala.org` tidak memiliki password bawaan. Setup ditutup atomik; rebuild tidak membuka setup lagi.

`npm run auth:recover-superuser` harus dijalankan di terminal interaktif; password diminta tersembunyi dua kali. Jangan menaruh password pada argumen, shell history, log atau chat. Perintah khusus akun Super User yang sudah ada, membuka kunci dan mencabut semua sesi. Jalur email menggunakan email pemulihan `Wapalatelkomuniversity@gmail.com`, bukan mailbox alias login.

`npm run email:worker` memproses batch outbox. Development EMAIL_MODE=sink membuang pengiriman tanpa menghubungi Gmail; hanya integration test menangkap pesan di memori. Produksi wajib EMAIL_MODE=smtp dengan SMTP env valid, TLS dan worker terjadwal pada tahap deployment. Pengiriman bersifat at-least-once, Message-ID stabil; retry maksimum lima, token reset tetap satu kali pakai dan kedaluwarsa 30 menit. Envelope reset dienkripsi di database lalu dibersihkan setelah selesai/kedaluwarsa. Link memakai fragment agar token tidak masuk request URL/access log.

Portal `/admin/foundation` adalah landing login nyata. Modul operasional menggunakan data server dan tidak memiliki mode preview atau data browser sebagai otoritas.

## Database runtime vs migration

Runtime produksi tidak boleh memakai akun superuser/owner migration. Operator membuat akun runtime lewat mekanisme password PostgreSQL interaktif. Contoh grant untuk schema public dan role `wapala_app` yang sudah dibuat:

```sql
GRANT CONNECT ON DATABASE wapala TO wapala_app;
GRANT USAGE ON SCHEMA public TO wapala_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO wapala_app;
REVOKE UPDATE, DELETE, TRUNCATE ON public."AuditLog" FROM wapala_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO wapala_app;
```

Terapkan grant ulang untuk tabel baru setelah migration. Jangan memberi CREATE/DROP, ownership, TRUNCATE, superuser atau akses `.prisma_migrations` kepada runtime; grant generic tabel di atas diikuti pencabutan akses migration table:

```sql
REVOKE ALL ON public._prisma_migrations FROM wapala_app;
```

Trigger audit juga menolak UPDATE/DELETE. Integration test menguji TRUNCATE/DELETE menggunakan role NOLOGIN sementara; runner memerlukan akses membuat role di cluster test khusus, bukan credential produksi. Sumber SQL role test memakai ID acak tervalidasi, bukan input HTTP.

## Batas bukti

Tes HTTP memakai port 3107 dan schema database random per-run; clean/drop hanya schema test tervalidasi. Kode build tidak membuka database atau mengirim SMTP. CSP nonce menjaga scripts produksi tanpa unsafe-inline/eval, tetapi inline style attributes yang sudah digunakan UI tetap diizinkan. Halaman dibuat dinamis untuk nonce; optimasi caching konten tahap berikutnya harus mempertahankan batas private/public.

Browser tidak dioperasikan atas permintaan pengguna. Tes HTTP/SSR bukan bukti interaksi visual lengkap; screenshot pengguna tetap menjadi UAT visual. Import Src/website, API operasional, ZIP bersih, Nginx/systemd/HTTPS dan backup/restore bukan deliverable 2A.
