# Build Linux tanpa membebani VPS

Workflow `Linux runtime release` dijalankan manual di GitHub Actions pada branch
`main`. Runner Ubuntu 22.04 x64 menggunakan Node 24.21.0, memasang dependency,
menjalankan unit/backend/integration tests dengan PostgreSQL disposable,
typecheck, lint dan Next production build sebelum mengunggah artifact.

Artifact berisi `wapala-linux-x64.tar.gz`, checksum SHA-256 dan `release.json`
dengan commit serta build ID. Tidak memasukkan secret VPS, env files, database,
CSV anggota/inventaris, atau paket album/angkatan staging. Dependency Linux
termasuk alat operasional Prisma/tsx disertakan agar VPS tidak perlu npm ci.
Ukuran paket/disk lebih besar dari standalone murni; ini tidak meningkatkan
heap aplikasi yang berjalan. Node runtime di VPS harus versi major 24.

Unduh artifact dari run yang berhasil, periksa commit yang diharapkan dan
`sha256sum -c wapala-linux-x64.tar.gz.sha256`, kemudian ekstrak ke direktori
release baru. Jangan menimpa release aktif atau memasukkan env ke artifact.
Jalankan migration menggunakan dependency paket dan environment privat di VPS.
Entrypoint tetap `.next/standalone/server.js`; static/public assets sudah
ditempatkan pada direktori standalone. Source dan dependency operator tetap
di root release untuk migration, import dan recovery CLI.

Build CI tidak otomatis deploy, tidak memerlukan SSH key VPS dalam GitHub,
dan tidak mengaktifkan auto-start. Activation tetap membutuhkan database,
konfigurasi email, HTTPS dan uji kapasitas aplikasi/antivirus. Kegagalan test
atau build menghentikan penerbitan artifact.
