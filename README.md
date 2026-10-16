<div align="center">

# WAPALA Website

[![CI host](https://github.com/WapalaTUP/website_wapala/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/WapalaTUP/website_wapala/actions/workflows/ci.yml)
[![Deploy](https://github.com/WapalaTUP/website_wapala/actions/workflows/deploy-host.yml/badge.svg?branch=main)](https://github.com/WapalaTUP/website_wapala/actions/workflows/deploy-host.yml)

**Sistem informasi WAPALA** — Wahana Pencinta Alam Telkom University Purwokerto
(Gunung & Hutan · Rock Climbing · Caving · Rafting)

[Website publik](https://wapala.my.id) · [Panel admin](https://wapala.my.id/wapala) · [Panduan deploy](host/deploy-walkthrough.md)

</div>

---

## Tentang

Platform web resmi WAPALA yang mencakup situs publik, panel administrasi, dan
modul operasional organisasi. Dibangun sebagai aplikasi full-stack dengan
fokus pada keamanan (sesi, CSRF, throttling, pemindaian antivirus) dan
deployment yang dapat diulang di VPS mana pun.

**Modul utama**

| Modul | Ringkasan |
| --- | --- |
| Situs publik | Profil & angkatan, divisi, berita/pengumuman, galeri, pembaca PDF/EPUB, kontak |
| Peminjaman alat | Katalog database, pengajuan, pelacakan, invoice PDF, persetujuan & verifikasi pengembalian |
| Open Recruitment | Periode tahunan, pendaftaran, foto, revisi, ekspor |
| Donasi | Kampanye, rekening penerima, poster, QRIS, verifikasi bukti transfer |
| Event | Pembuat formulir dinamis, pendaftaran, unggahan, ekspor Excel |
| Admin | Anggota, angkatan, inventaris, konten, pengguna & peran, pengaturan, arsip, audit log |

## Teknologi

| Lapisan | Teknologi |
| --- | --- |
| Aplikasi | Next.js 16 (standalone output), React 19, TypeScript |
| Data | PostgreSQL + Prisma 7 (driver adapter `pg`) |
| Keamanan | Argon2, cookie sesi HttpOnly, CSRF same-origin, throttling persisten, audit log |
| Media | Penyimpanan privat di disk + pemindaian ClamAV (fail-closed) |
| Runtime | systemd (sandbox ketat) · Nginx · TLS Let's Encrypt |
| Otomasi | GitHub Actions (CI gate + deploy SSH opsional) |

## Arsitektur deployment

```text
  git push (branch main)
        │
        ▼
  host/wapala.sh atau GitHub Actions ──▶ VPS
        │
        ▼
  host/host-deploy.sh
        │  1. clone release baru (branch main)
        │  2. npm ci + next build        (heap dibatasi, user non-root)
        │  3. prisma migrate deploy      (role owner, terpisah dari runtime)
        │  4. symlink atomik             /srv/wapala/current → release baru
        │  5. systemctl restart          (sandbox systemd)
        │  6. health check /api/health
        ▼
     gagal ⟶ rollback otomatis ke release sebelumnya
```

Aplikasi berjalan sebagai user non-root `wapala`, hanya listen `127.0.0.1:3000`.
Kode release dimiliki `root` — runtime hanya boleh menulis `.next/cache` dan
folder media. Nginx adalah satu-satunya gerbang publik.

## Memulai

### Prasyarat

| Kebutuhan | Minimum | Catatan |
| --- | --- | --- |
| VPS | Ubuntu 22.04/24.04, 2 GB RAM, disk ≥ 3 GB | 1 GB berisiko OOM saat build |
| Akses | SSH root atau user dengan sudo | Semua langkah butuh systemd |
| Domain | 1 domain dengan A record ke server | Wajib untuk TLS Let's Encrypt |
| Repository | Publik, atau private + deploy key | Default clone: repo ini |

### Instalasi satu perintah (interaktif)

```bash
git clone --branch main --single-branch https://github.com/WapalaTUP/website_wapala.git wapala-setup
cd wapala-setup
sudo bash host/wapala.sh
```

Installer interaktif akan menanyakan: mode VPS (dedicated/NAT), domain, email
sertifikat, ClamAV, dan firewall — lalu menjalankan provisioning, build, deploy,
health check, hingga bootstrap Super User. Jalankan ulang kapan pun: script
bersifat idempoten dan mendeteksi instalasi yang sudah ada.

### Instalasi manual (non-interaktif)

Untuk otomasi/CI — atau bila lebih suka langkah eksplisit:

```bash
# 1. Provisioning (paket, Node 24, PostgreSQL, Nginx, TLS, env privat)
sudo bash host/host-provision.sh <domain> <email>

# 2. Deploy (clone, build, migrate, aktivasi, health check)
sudo bash host/host-deploy.sh
```

📖 Walkthrough end-to-end dari kasus nyata (termasuk pengaturan nameserver,
DirectAdmin, dan jebakan yang ditemui): [host/deploy-walkthrough.md](host/deploy-walkthrough.md)

## Manajemen server

Setelah terpasang, seluruh operasional harian melalui satu menu:

```bash
sudo bash host/wapala.sh
```

```text
1) Deploy ulang (pull + build + migrate)     6) Prune maintenance manual
2) Status (service, RAM, release)            7) Pasang ClamAV
3) Log aplikasi (live)                       8) Import Album awal
4) Rollback ke release sebelumnya            9) Info sertifikat TLS
5) Backup database + media                   0) Keluar
```

## Import Album awal

Mengisi data publik awal (angkatan, album galeri, foto) dari paket yang telah
diaudit di branch `staging` repo development. Importer bersifat **idempoten** —
tidak pernah menghapus data; re-import hanya melaporkan yang dilewati.

```bash
sudo bash host/import-album.sh
```

Alur: konfirmasi sumber paket → **backup wajib** → cek service (PostgreSQL +
ClamAV) → unduh paket → **dry-run** → review laporan → apply → verifikasi
hitungan database. Anggota dan inventaris tidak termasuk dalam paket.

## Runbook operasional

| Kebutuhan | Perintah |
| --- | --- |
| Deploy rilis baru | `sudo bash host/wapala.sh` → Deploy ulang |
| Deploy manual non-interaktif | `sudo WAPALA_REPO_URL=... bash host/host-deploy.sh` |
| Log aplikasi | `journalctl -u wapala -f` |
| Rollback manual | `sudo ln -sfn /srv/wapala/releases/ID_LAMA /srv/wapala/current && sudo systemctl restart wapala` |
| Backup | `sudo node scripts/release-backup.mjs backup /root/backup-$(date +%F)` |
| Migration manual | `sudo sh -c 'set -a; . /etc/wapala/production.env; set +a; cd /srv/wapala/current; npm run db:migrate'` |
| Prune manual | `sudo sh -c 'set -a; . /etc/wapala/production.env; set +a; cd /srv/wapala/current; npm run maintenance:prune'` |
| Bootstrap Super User | `sudo sh -c 'set -a; . /etc/wapala/production.env; set +a; cd /srv/wapala/current; npm run auth:bootstrap-token'` |
| Pemulihan Super User | `... npm run auth:recover-superuser` (prompt tersembunyi via SSH) |
| Import situs publik | `sudo bash host/import-album.sh` |

Tiga release terakhir disimpan di `/srv/wapala/releases`; sisanya dibersihkan
otomatis. Rollback otomatis terjadi bila health check gagal pasca-deploy.
Catatan: migration sudah berjalan sebelum rollback — ikuti disiplin
[expand/contract](https://openfresh.github.io/expand-contract/) untuk skema database.

## Model keamanan

- **Least privilege** — aplikasi non-root, database runtime tanpa DDL/TRUNCATE;
  migrasi lewat role owner terpisah; build & migrate sebagai user `builder` non-root.
- **Sandbox systemd** — `ProtectSystem=strict`, `PrivateDevices`, filter syscall,
  kernel interfaces dibatasi; kode release root-owned (RCE tidak dapat menimpa kode).
- **Fail-closed media** — unggahan dipindai ClamAV **sebelum** di-decode; tanpa
  scanner, unggahan ditolak (503).
- **Brute-force** — lockout login per kombinasi (email, IP) 24 jam tanpa lock
  permanen; throttle Nginx + aplikasi berlapis; audit log untuk aksi sensitif.
- **Secret minim permukaan** — hanya `/etc/wapala/production.env` (root `0600`)
  dan GitHub Secrets; deploy script membaca env baris-per-baris tanpa shell-eval;
  password database tidak pernah lewat argv proses.
- **Email** — `EMAIL_MODE=disabled` pada provider yang memblokir SMTP
  (pemulihan akun via panel admin atau SSH).

## Kapasitas

VPS 2 GB menjalankan PostgreSQL + Next.js (+ ClamAV bila aktif) sekaligus.
`host/host-deploy.sh` memakai batas bawaan berikut:

| Variabel | Default | Fungsi |
| --- | --- | --- |
| `WAPALA_HEAP_CI` | `512` | Heap MB saat `npm ci` |
| `WAPALA_HEAP_BUILD` | `768` | Heap MB saat `next build` |
| `WAPALA_MIN_DISK_MB` | `2048` | Tolak deploy bila disk kurang |
| `WAPALA_KEEP_RELEASES` | `3` | Release yang disimpan |

Build di-set serial (`UV_THREADPOOLSIZE=1`, `MALLOC_ARENA_MAX=2`,
`npm_config_maxsockets=1`); runtime dibatasi systemd (`MemoryMax=900M`).
Build `Killed` = RAM kurang; runtime sering restart = periksa OOM di
`journalctl -k` dan sesuaikan `NODE_OPTIONS` atau kapasitas.

## Troubleshooting

| Gejala | Periksa |
| --- | --- |
| CI merah sebelum deploy | Log workflow `CI host` — typecheck/lint/format/build |
| Deploy gagal di tahap SSH | Secrets `VPS_HOST/PORT/USER/SSH_KEY/KNOWN_HOSTS` (semua wajib) |
| `Certbot gagal` saat provisioning | DNS belum mengarah, atau NAT tanpa forwarding publik `:80` |
| Build `Killed` | RAM — lihat [Kapasitas](#kapasitas) |
| Health check gagal → rollback | `journalctl -u wapala -n 100`; cek env/database |
| Login `423` | Lock per (email, IP) aktif (6× salah, 24 jam) — tunggu atau unlock via panel |
| Upload `503` | ClamAV belum terpasang/mati — `host/wapala.sh` → Pasang ClamAV |
| Upload `413` | Buku maks 50 MB; pastikan nginx `client_max_body_size 60m` |
| Aset 404 | Deploy harus via script (menyalin `.next/static` + `public` ke standalone) |

## Struktur repositori

```text
.github/workflows/
  ci.yml                    # Gate: typecheck + lint + format + build (push/PR)
  deploy-host.yml           # Deploy SSH manual (workflow_dispatch) — opsional
host/
  wapala.sh                 # Installer interaktif + menu manajemen
  import-album.sh           # Import paket situs publik (idempoten)
  host-provision.sh         # Provisioning VPS (paket, DB, env, systemd, Nginx, TLS)
  host-deploy.sh            # Deploy berulang (build, migrate, aktivasi, health check)
  wapala-host.service       # Unit systemd aplikasi (sandbox ketat)
  wapala-maintenance.*      # Timer prune harian (throttle/sesi/token)
  nginx-wapala*.conf        # Template Nginx: dedicated IP & NAT VPS
  clamdscan-wapala.sh       # Wrapper scanner ClamAV (--stream)
  deploy-walkthrough.md     # Walkthrough deployment nyata end-to-end
scripts/                    # Tool operasional: bootstrap, recovery, worker, backup, prune, import
prisma/                     # Schema + migrations
src/ public/                # Source aplikasi
```

## Model branch

```text
main  ◄──────── production (deploy dari sini)
  ▲
  └── merge dari host setelah CI hijau

host  ──── development harian
```

- Perubahan dikerjakan di `host`, diverifikasi CI, lalu di-merge ke `main`.
- Server men-deploy `main` (default `WAPALA_BRANCH=main` pada deploy script).
- Branch ini sengaja hanya memuat kode deployment — tidak ada aset development
  yang tidak diperlukan runtime.

---

<div align="center">
<sub>Dikelola oleh WAPALA — pembaruan aplikasi cukup dengan satu perintah.</sub>
</div>
