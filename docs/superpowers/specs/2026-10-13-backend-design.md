# Backend WAPALA — desain tahap 2

Tanggal: 13 Oktober 2026. Status: rancangan untuk review pengguna; belum implementasi.

## Tujuan dan keputusan pengguna

Tahap frontend diterima. Backend membuat data persisten, autentikasi nyata, izin server dan audit untuk operasi WAPALA, tanpa mengubah arah UI yang disetujui. PRD dan revisi terbaru adalah sumber kebutuhan; revisi eksplisit mengungguli PRD lama.

- Target: Ubuntu versi 22 atau lebih baru, VPS khusus yang masih kosong, RAM 2 GB, tanpa Docker untuk produksi. Versi OS aktual diperiksa saat persiapan deploy; belum ada akses SSH yang digunakan.
- Next.js + TypeScript terpadu, PostgreSQL, Prisma. Vercel hanya pertanyaan kompatibilitas, bukan perubahan target.
- Super User: `superuser@wapala.org`; email pemulihan: `Wapalatelkomuniversity@gmail.com`.
- Identitas admin: `POH@wapala.org`, `Logistik@wapala.org`, `Kerjasama@wapala.org`. Identitas login tidak berarti mailbox dibuat.
- Autentikasi memakai sesi database dan cookie HttpOnly, bukan token login di localStorage. Password Argon2id.
- Pemulihan lewat email sebagai jalur utama, perintah SSH sebagai fallback.
- ZIP akhir kode siap build tidak berisi data organisasi, aset hasil impor, credentials, uploads, database dump, output, dependency atau build. Paket impor terpisah dan privat.
- Sumber impor: seluruh Src yang diinventarisasi dan konten/foto/album/keterangan website WAPALA aktif. Tidak ada seed demo produksi.
- Tidak mengoperasikan browser; pengguna meninjau UI melalui screenshot.

## Pilihan arsitektur

Dipilih: monolit modular Next.js dengan service server dan PostgreSQL. Memakai frontend yang ada, satu deployment, tanpa menambah Express hanya untuk middleware.

Alternatif backend terpisah Express/Nest menambah deployment dan kontrak antaraplikasi tanpa kebutuhan saat ini. Alternatif Vercel memerlukan penyesuaian storage persisten, database dan pekerjaan impor; bukan target yang dipilih pengguna.

Modul server hanya diimpor oleh kode server. Route Handler memvalidasi request, autentikasi/izin dan CSRF, lalu memanggil service domain. Repository Prisma mengakses database; respons menggunakan DTO eksplisit, tidak serialisasi record privat utuh. Client tidak dapat mengirim role/aktor audit yang dipercaya server.

## Pembagian pekerjaan

2A — Fondasi: PostgreSQL/Prisma dan migration, konfigurasi tervalidasi, bootstrap, login/logout/password wajib ganti, pemulihan email/SSH, RBAC, audit, pengaturan awal, health check dan integration test. Ini implementasi pertama yang dibuatkan rencana rinci.

2B — Domain operasional: anggota/konten/galeri/buku, OR tahunan, inventaris/peminjaman, invoice dan multi-kampanye donasi. Setiap modul memiliki service, izin dan test transaksi. Ketentuan UI terbaru tetap berlaku.

2C — Importer dan paket: inventaris sumber, staging data, validasi/mapping, deduplikasi, media/storage dan paket impor berversi; integrasi SMTP untuk notifikasi domain serta ZIP source bersih.

Integrasi seluruh halaman, hardening deployment, backup/restore, CAPTCHA dan UAT penuh ditutup pada tahap 3 sesuai PRD. Kontrol keamanan dasar pada endpoint yang dibuat tidak ditunda hingga tahap 3. Deploy server nyata dan pengiriman email nyata tidak dilakukan hanya karena kode lokal selesai.

## Model dan kontrak fondasi 2A

Entitas: User, Session, PasswordResetToken, BootstrapState, AuditLog, SiteSettings, SecurityThrottle dan EmailOutbox. Role enum: SUPER_USER, POH, MULTIMEDIA, INVENTARIS; label publik tetap sesuai UI. Email login dinormalisasi untuk uniqueness tanpa mengubah identitas yang ditampilkan.

User menyimpan email, nama, role, passwordHash, mustChangePassword, status aktif/arsip, failedLoginCount, lockUntil, recoveryEmail dan timestamps. Session menyimpan digest token acak kriptografis, userId, createdAt, expiresAt dan revokedAt. Token mentah tidak disimpan di database/log. Status user dan sesi diverifikasi server, bukan hanya pada cookie.

Seed produksi hanya struktur izin, pengaturan organisasi dasar yang disetujui dan singleton bootstrap; tidak akun dengan password bawaan, anggota contoh, stok contoh, pendaftar/donasi contoh atau contoh Marapi/Demak. OR dan kampanye awal nonaktif. Database baru belum memiliki Super User hingga bootstrap selesai.

Migration di-version-control; tidak memakai db push sebagai prosedur produksi. Perubahan kompatibilitas dan rollback data diuraikan pada rencana masing-masing modul, bukan diasumsikan aman karena build lulus.

## Bootstrap dan akun admin

Sebelum Super User dibuat, `/wapala` menawarkan setup dengan token instalasi yang dibuat melalui perintah server. Token acak berbatas waktu, disimpan sebagai digest dan dimasukkan melalui body request, tidak URL. Database transaction/locking memastikan dua request bersamaan tidak membuat dua akun pertama. Setelah selesai, setup tertutup dan token tidak dapat dipakai kembali; rebuild tidak membuka ulang.

Super User membuat tiga admin maupun pengguna tambahan; sistem menghasilkan credential sementara, ditampilkan hanya pada tindakan berizin, tidak di-log. Admin harus mengganti password sebelum mengakses domain operasional. Super User terakhir yang aktif tidak boleh dinonaktifkan/diarsipkan melalui operasi biasa.

Masa sesi absolut maksimum 30 hari. Logout mencabut sesi berjalan; reset/perubahan password dan nonaktif akun mencabut seluruh sesi terkait dalam transaksi yang sama. Hanya cookie opaque session HttpOnly, Secure pada HTTPS produksi, SameSite=Lax, Path=/ dan tanpa domain luas. Token CSRF terpisah dari token sesi.

Login mengembalikan error generik, menggunakan verifikasi hash dummy untuk email tidak dikenal dan rate limit gabungan IP pseudonim/email. Tiga kegagalan mengunci 15 menit; tiga kegagalan tambahan setelah kunci habis membutuhkan pembukaan Super User. Sukses sebelum eskalasi mereset hitungan; reset berizin dapat membuka kembali akun. Super User terkunci dapat dipulihkan lewat jalur email atau SSH, bukan bypass publik.

## Pemulihan dan keamanan request

Permintaan reset email selalu merespons generik. Token satu kali acak dengan digest dan masa berlaku 30 menit; URL dibuat dari APP_URL tervalidasi, tidak Host header request. Konsumsi token, perubahan hash, pencabutan sesi dan audit terjadi atomik. Email memuat informasi minimum, tidak password.

Perintah pemulihan SSH berjalan hanya pada host/server oleh pengelola berizin OS. Input password tersembunyi di terminal dengan konfirmasi; tidak menerima password lewat argumen CLI atau log. Perintah mengonfirmasi akun sasaran, memperbarui hash, membuka kunci, menghapus token reset aktif, mencabut semua sesi dan mencatat aktor bertipe SERVER_OPERATOR. Tidak ada endpoint publik untuk mengaktifkan fallback SSH.

Keamanan: validasi schema di boundary, RBAC tiap operasi, query Prisma terparameterisasi tanpa raw SQL rakitan pengguna, batas ukuran request, sanitasi rich-text/URL untuk modul konten, output encoding, CSP dan security headers Next.js/Nginx. Mutasi cookie-auth memakai token CSRF terkait sesi dan validasi Origin sesuai APP_URL; SameSite bukan satu-satunya perlindungan. GET tidak mengubah state. `csurf` yang diarsipkan tidak dipakai; Helmet tidak ditambahkan tanpa Express.

Password minimal 12 karakter, mendukung passphrase, dibatasi byte agar hashing tidak menjadi DoS; parameter Argon2id minimal mengikuti OWASP dan dibenchmark pada server. Hashing login dibatasi konkurensinya untuk RAM 2 GB. Jangan mencatat token, password, SMTP secret atau body data pribadi dalam error/log.

Audit append-only pada level service dan hak database produksi: aktor terverifikasi, aksi, entitas, ID, ringkasan aman, waktu, IP pseudonim dan user-agent terbatas. Tidak mengaudit isi password, token atau semua field pribadi. Kegagalan audit untuk operasi material menggagalkan transaksi, bukan melanjutkan diam-diam.

EmailOutbox merekam pekerjaan email dalam transaksi, dikirim worker terpisah dengan retry terbatas dan idempotency key. SMTP dev memakai sink/test adapter; email organisasi tidak dihubungi otomatis dari development. Credentials SMTP diberikan melalui environment server, bukan chat/repo.

## Kontrak domain 2B

- Anggota privat; POH/Super User write. OR read untuk seluruh admin, write Multimedia/Super User. Impor/ekspor mengikuti izin dan diaudit.
- Inventaris/peminjaman write Inventaris/Super User. Persetujuan stok memakai transaksi/locking per alat, memperhitungkan tanggal tumpang tindih dan request serentak. API publik tidak mengungkap stok internal, lampiran/jaminan privat, atau data pengajuan lain.
- OR hanya satu periode aktif dan satu entitas per tahun; revisi via kode/telepon dibatasi percobaan. Pas foto privat. Riwayat revisi dan ekspor disimpan.
- Kampanye terpisah, beberapa rekening bank dengan nomor teks/nama penerima, poster dan QRIS per kampanye. Konfirmasi terikat campaignId dan snapshot rekening; verifikasi idempotent, total hanya terverifikasi/nonarsip. Tidak ada integrasi pembayaran otomatis atau identitas donatur publik.
- Reset kepengurusan hanya Super User: arsip selesai/ditolak, bawa kewajiban aktif tanpa membebaskan stok, pertahankan OR. Pilihan reset password tiap admin/pengguna; Super User terpisah. Mutasi akun dan rollover atomik.
- PDF invoice server hanya data disetujui, watermark WAPALA, logo Tel-U, QR URL APP_URL, dua salinan per A4 landscape. Bukti foto privat melalui endpoint berizin.

## Impor dan paket 2C

Inventaris seluruh file Src sebagai manifest lokal dengan checksum, jenis, asal dan status mapping. File yang belum bisa dipetakan, korup, ambigu atau sensitif dicatat dalam laporan; tidak diabaikan tanpa laporan, tidak otomatis diterbitkan. Anggota/inventaris diimpor ke domain privat, dokumen pendukung disimpan sesuai klasifikasi. Tidak semua dokumen organisasi layak dijadikan konten publik.

Konten website dikumpulkan lewat fetch/parser/importer, bukan browser UI. Catat URL sumber, identitas album/foto, checksum, kategori, judul, keterangan, tanggal yang benar-benar tersedia, urutan sumber dan jumlah coverage. Koleksi frontend lama bukan bukti seluruh website sudah tercakup. Refresh koleksi dan laporkan kegagalan URL/foto. Tanggal tidak dikenal nullable; waktu impor tidak diklaim tanggal kegiatan.

Pisahkan ekstraksi dari commit. Paket data berisi manifest, data normalisasi, berkas media dan laporan validasi; tanpa credentials. Preview/dry-run wajib sebelum apply. ImportRun menyimpan versi paket/checksum dan mapping identitas sumber; duplicate run tidak menambah record. Perubahan isi sumber tidak menimpa edit admin otomatis; tampilkan konflik untuk resolusi berizin. Impor batch database atomik; pemindahan media staged dapat dilanjutkan dengan checkpoint dan cleanup terkontrol.

Kode produksi tidak memuat seed demo, fallback localStorage atau aset organisasi hasil impor di ZIP source. UI kosong menampilkan empty state, bukan data contoh. Asset struktural yang berasal dari organisasi juga dipaketkan di bundle impor; default aplikasi memakai placeholder netral, bukan logo/foto mock.

Pada server: install dependencies/build kode dahulu, jalankan migration terkontrol, unggah bundle impor ke lokasi privat, dry-run/apply impor versi pertama, bootstrap Super User dengan token instalasi, health check lalu publikasi. Bukan efek samping `next build`; rebuild tidak mengimpor ulang atau menimpa data. Runbook menjelaskan urutan ini sehingga paket siap deployment awal.

## Lingkungan dan verifikasi

Pengembangan database PostgreSQL terisolasi dari produksi. Native PostgreSQL dipakai tanpa kewajiban Docker. Credentials/test database tidak ditebak, layanan OS tidak dipasang/diubah diam-diam. Jika service lokal belum tersedia, laporkan dan ikuti petunjuk setup yang disepakati; jangan mengklaim integration test lulus tanpa database nyata.

Pengujian 2A: bootstrap race/replay, login gagal/lock/unlock, sesi expiry/revocation, wajib ganti, role bypass/IDOR, CSRF/origin, SQL injection inputs, recovery token expiry/reuse/concurrency, pemulihan SSH, audit atomik, migration dari database kosong dan seed tanpa demo, email outbox retry tanpa mengirim email nyata. Unit dan integration tests memakai fixtures fiktif terisolasi, tidak seed produksi.

Pengujian modul berikutnya meliputi impor ulang/checksum/conflict/privasi, double verification donasi, stok peminjaman serentak, rollover aktif, keamanan media dan PDF. Jalankan suite frontend existing, typecheck, lint dan build. Verifikasi HTTP/API melalui alat non-browser. Screenshot pengguna untuk penerimaan visual.

Deployment systemd/Nginx, TLS, backup harian tujuh hari dan restore staging ditangani tahap 3. Build RAM 2 GB dapat memerlukan build terpisah/swap; benchmark sebelum runbook menetapkan prosedur, bukan janji semua build muat RAM. Jangan menjalankan aplikasi sebagai root.

## Acceptance fondasi dan batas persetujuan

2A selesai ketika migration/seed aman, bootstrap/login/reset/RBAC/audit bekerja melalui server dengan tests database nyata, tanpa mengubah data produksi atau mengirim email nyata. Tidak menyebut seluruh backend selesai saat baru fondasi yang lulus.

Dokumen ini belum memberi izin deployment, provisioning layanan eksternal berbayar, publikasi dokumen privat, atau penghapusan sumber. Tidak ada Git repository pada checkout saat pemeriksaan sebelumnya; dokumen disimpan lokal tanpa klaim commit. Setelah pengguna meninjau spesifikasi, susun rencana implementasi 2A untuk approval eksekusi; 2B/2C mendapat rencana terpisah agar scope dapat diverifikasi.
