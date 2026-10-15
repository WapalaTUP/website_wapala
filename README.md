# Website WAPALA — Production Deploy (`host`)

[![Deploy host](https://github.com/hulwanulazka-companion/wapala_dev/actions/workflows/deploy-host.yml/badge.svg?branch=host)](https://github.com/hulwanulazka-companion/wapala_dev/actions/workflows/deploy-host.yml)

Branch `host` adalah **paket deployment siap otomatis** untuk Website WAPALA — situs resmi unit kegiatan mahasiswa Wahana Pencinta Alam Telkom University (Gunung & Hutan, Rock Climbing, Caving, Rafting). Situs aktif: [wapala.my.id](https://wapala.my.id).

Satu alur untuk semua VPS: **push ke branch `host` → GitHub Actions menyambung SSH ke server → aplikasi di-build hemat memori, dimigrasi, diaktifkan atomik, dan diperiksa kesehatannya — otomatis dengan rollback bila gagal.**

## Fitur aplikasi (ringkas)

- Situs publik: profil/angkatan, divisi, berita, galeri, pembaca PDF/EPUB, kontak.
- Peminjaman alat: katalog, pengajuan, invoice, persetujuan, verifikasi pengembalian.
- Open Recruitment, Donasi (QRIS + verifikasi bukti), Event (formulir dinamis + ekspor Excel).
- Admin: anggota, angkatan, inventaris, konten, pengguna/peran, arsip, audit.

| Lapisan | Teknologi |
| --- | --- |
| Aplikasi | Next.js 16 (standalone), React 19, TypeScript |
| Data | PostgreSQL + Prisma 7 (adapter `pg`) |
| Keamanan | Argon2, sesi HttpOnly, CSRF, throttling, media privat |
| Media | Disk lokal `MEDIA_ROOT`, pemindaian ClamAV (opsional, fail-closed) |
| Runtime | systemd + Nginx + TLS (Let's Encrypt) |

## Arsitektur deployment

```text
  Git push (branch host)
        │
        ▼
  GitHub Actions ── SSH (kunci deploy) ──▶ VPS: host/host-deploy.sh
                                              │  1. git clone release baru
                                              │  2. npm ci + next build   (heap dibatasi)
                                              │  3. prisma migrate deploy (+ grant role runtime)
                                              │  4. symlink /srv/wapala/current → release baru
                                              │  5. systemctl restart wapala
                                              │  6. health check /api/health
                                              ▼
                                     gagal ⟶ rollback otomatis ke release sebelumnya
```

Aplikasi berjalan sebagai user non-root `wapala`, hanya listen `127.0.0.1:3000`; Nginx meneruskan trafik HTTPS dari publik.

## Prasyarat

| Kebutuhan | Nilai minimum | Catatan |
| --- | --- | --- |
| VPS | Ubuntu 22.04/24.04, **2 GB RAM**, disk ≥ 3 GB | 1 GB berisiko OOM saat build (lihat [Kapasitas](#kapasitas--build-hemat-memori)) |
| Akses | SSH root atau sudo | Provisioning + deploy butuh systemd |
| Domain | 1 domain (A record) | NAT VPS: daftarkan domain di panel provider |
| Repository | GitHub repo ini | Private repo tetap bisa (atur `VPS_REPO_URL` + deploy key) |

## Pilih mode VPS

| | **A. Dedicated IP** | **B. NAT VPS** |
| --- | --- | --- |
| IP publik | Khusus untuk VPS ini | Dibagi antar pelanggan provider |
| Port | 22, 80, 443 standar | Terbatas pada port yang diteruskan provider (mis. SSH `33333`, HTTP `33335`, HTTPS `33336`) |
| DNS | `A record domain → IP VPS` | `A record domain → IP publik provider` **+** daftarkan domain di panel provider agar gateway tahu rute ke VPS Anda |
| Sertifikat | Certbot HTTP-01 (port 80) | Certbot HTTP-01 hanya bila provider meneruskan publik `:80` → port HTTP internal; bila tidak, gunakan DNS-01 atau `WAPALA_SKIP_CERTBOT=1` |
| Biaya relatif | Lebih mahal | **Lebih murah** |

> NAT bukan "DNS forwarding". DNS hanya menerjemahkan nama → IP; rute port publik → port internal ditentukan panel provider (port forwarding). Di provider yang sama, pastikan HTTP publik (80) dan HTTPS publik (443 atau port khusus) diteruskan ke port internal yang benar.

---

## Langkah 1 — Provisioning (sekali saja)

SSH ke VPS, lalu clone branch `host` dan jalankan provisioning:

```sh
apt-get update && apt-get install -y git
git clone --branch host --single-branch https://github.com/hulwanulazka-companion/wapala_dev.git wapala-setup
cd wapala-setup
```

**Opsi A — Dedicated IP:**

```sh
sudo bash host/host-provision.sh contoh-domain.com admin@contoh-domain.com
```

**Opsi B — NAT VPS** (sesuaikan pasangan port dari panel provider):

```sh
sudo WAPALA_NAT_MODE=1 \
     WAPALA_NAT_HTTP_PORT=33335 \
     WAPALA_NAT_HTTPS_PORT=33336 \
     bash host/host-provision.sh contoh-domain.com admin@contoh-domain.com
```

Script melakukan semua hal berikut secara idempoten: paket sistem + Node.js 24, PostgreSQL, Nginx, Certbot, pembuatan user layanan `wapala`, database beserta **dua role** (owner untuk migrasi, runtime terbatas tanpa DDL), file env privat `0600`, unit systemd, Nginx HTTP → sertifikat TLS → Nginx HTTPS.

Opsi tambahan (environment sebelum perintah):

| Variabel | Fungsi |
| --- | --- |
| `WAPALA_PROVISION_CLAMAV=1` | Pasang ClamAV + wrapper scanner. **Tanpa ini, unggahan media ditolak (fail-closed).** |
| `WAPALA_SKIP_CERTBOT=1` | Lewati penerbitan sertifikat (atur TLS/DNS-01 manual). |
| `WAPALA_ENABLE_UFW=1` | Aktifkan firewall (SSH, 80/443 + port NAT). |
| `WAPALA_DB_PASSWORD`, `WAPALA_APP_DB_PASSWORD` | Password database dibuat manual (bila kosong dibuat acak). |

Di akhir, script mencetak ringkasan berisi password database dan langkah berikutnya — **catat privat, jangan disebarkan**.

## Langkah 2 — DNS

- **Dedicated:** buat `A record` `@` (dan `www`) → IP publik VPS. Verifikasi: `dig +short contoh-domain.com`.
- **NAT:** `A record` → IP publik provider **dan** daftarkan/forwarding domain di panel provider (Source Domain) sesuai pasangan port. Verifikasi juga dari luar: `curl -I http://contoh-domain.com`.

DNS harus aktif **sebelum** provisioning jika ingin sertifikat diterbitkan otomatis.

## Langkah 3 — Environment privat

```sh
sudo nano /etc/wapala/production.env
```

File dibuat oleh provisioning dengan nilai aman bawaan. Yang perlu diperiksa:

| Variabel | Ketentuan |
| --- | --- |
| `APP_URL` | Origin HTTPS canonical, mis. `https://contoh-domain.com` |
| `DATABASE_URL` | Role runtime `wapala_app` (tanpa DDL) — bawaan provisioning |
| `MIGRATE_DATABASE_URL` | Role owner `wapala` untuk `db:migrate` — bawaan provisioning |
| `SECURITY_KEY` | 32 byte base64 (sudah digenerate; backup privat, jangan rotasi sembarangan) |
| `EMAIL_MODE` | `disabled` bila provider memblokir SMTP (notifikasi off, pemulihan via SSH). `smtp` + isi `SMTP_*` bila tersedia |
| `MEDIA_SCANNER` | Aktif hanya bila ClamAV terpasang (`WAPALA_PROVISION_CLAMAV=1`) |
| `PORT` | `3000` (internal; Nginx yang membuka port publik) |

Format file adalah assignment shell-compatible (`KEY=value`), dimuat systemd dan script deploy.

## Langkah 4 — GitHub secrets

Buat kunci SSH khusus deploy (di mesin lokal), tanpa passphrase agar otomatis:

```sh
ssh-keygen -t ed25519 -f wapala_deploy_key -C "wapala-deploy" -N ""
ssh-copy-id -i wapala_deploy_key.pub root@IP_VPS        # atau manual ke ~/.ssh/authorized_keys
ssh-keyscan -p PORT_SSH IP_VPS                          # output → VPS_KNOWN_HOSTS
```

Tambahkan di **Settings → Secrets and variables → Actions**:

| Secret | Wajib | Isi |
| --- | --- | --- |
| `VPS_HOST` | ✅ | IP/host VPS (dedicated) atau IP publik provider (NAT) |
| `VPS_USER` | ✅ | `root` atau user sudo |
| `VPS_SSH_KEY` | ✅ | Isi file kunci **privat** `wapala_deploy_key` |
| `VPS_PORT` | NAT | Port SSH publik dari provider (dedicated: kosongkan = 22) |
| `VPS_KNOWN_HOSTS` | disarankan | Output `ssh-keyscan` (mencegah MITM) |
| `VPS_REPO_URL` | repo private | URL clone + kredensial/deploy key bila repo tidak publik |

## Langkah 5 — Deploy

Deploy pertama: push apa pun ke branch `host`, atau jalankan manual **Actions → Deploy host → Run workflow**. Pantau log di tab Actions; tahapan clone → build → migrate → restart → health check tampil lengkap di sana.

Verifikasi setelah hijau:

```sh
curl -fsS https://contoh-domain.com/api/health
```

## Langkah 6 — Bootstrap Super User

```sh
sudo sh -c 'set -a; . /etc/wapala/production.env; set +a; cd /srv/wapala/current; npm run auth:bootstrap-token'
```

Token sekali pakai berlaku 30 menit — buka `https://contoh-domain.com/wapala` dan buat akun Super User. Tidak ada password bawaan; setup sudah selesai tidak perlu diulang. Pemulihan akun Super User: `npm run auth:recover-superuser` (prompt password tersembunyi via SSH).

---

## Operasional harian

| Kebutuhan | Perintah |
| --- | --- |
| Deploy rilis baru | `git push origin host` (atau Run workflow) |
| Deploy manual di server | `sudo WAPALA_REPO_URL=https://github.com/.../wapala_dev.git bash host/host-deploy.sh` |
| Log aplikasi | `journalctl -u wapala -f` |
| Status service | `systemctl status wapala` |
| Rollback manual | `sudo ln -sfn /srv/wapala/releases/ID_LAMA /srv/wapala/current && sudo systemctl restart wapala` |
| Backup database+media | `sudo node scripts/release-backup.mjs backup /root/backup-$(date +%F)` |
| Migration manual | `sudo sh -c 'set -a; . /etc/wapala/production.env; set +a; cd /srv/wapala/current; npm run db:migrate'` |

Rollback **otomatis** terjadi bila health check gagal setelah deploy: symlink dikembalikan ke release sebelumnya dan service direstart. Database rollback bukan bagian dari symlink — gunakan backup.

Tiga release terakhir disimpan di `/srv/wapala/releases`; yang lebih lama dihapus otomatis.

### Worker terjadwal (opsional)

Bila `EMAIL_MODE=smtp`, jalankan worker email via cron/systemd timer: `npm run email:worker`. Worker `loans:overdue` (denda/keterlambatan) dan `media:cleanup-events` serupa. Contoh crontab (sebagai root, memuat env privat):

```cron
17 1 * * * sh -c 'set -a; . /etc/wapala/production.env; set +a; cd /srv/wapala/current; npm run loans:overdue'
```

Jangan menjadwalkan worker email pada mode `disabled`.

## Kapasitas & build hemat memori

VPS 2 GB menjalankan PostgreSQL + Next.js (+ ClamAV bila dipasang) sekaligus. `host/host-deploy.sh` sudah menerapkan batas bawaan:

| Variabel | Default | Fungsi |
| --- | --- | --- |
| `WAPALA_HEAP_CI` | `512` | Heap MB saat `npm ci` |
| `WAPALA_HEAP_BUILD` | `768` | Heap MB saat `next build` |
| `WAPALA_MIN_DISK_MB` | `2048` | Tolak deploy bila disk kurang |
| `WAPALA_KEEP_RELEASES` | `3` | Jumlah release yang disimpan |

Selain itu build di-set serial (`UV_THREADPOOLSIZE=1`, `MALLOC_ARENA_MAX=2`, `npm_config_maxsockets=1`) dan runtime dibatasi systemd (`MemoryMax=900M`). Bila build tetap terbunuh (`Killed`/exit non-nol): kurangi beban lain saat deploy, atau naikkan sementara ke `WAPALA_HEAP_BUILD=1024` **hanya jika RAM cukup**. Bila runtime sering restart (OOM di `journalctl`), turunkan `NODE_OPTIONS` di env file atau pindahkan ClamAV/naikkan kapasitas.

Build sukses ditandai `.next/BUILD_ID` dan `.next/standalone/server.js`; script menolak mengaktifkan rilis tanpa keduanya.

## Keamanan & batasan

- Aplikasi non-root, `ProtectSystem=strict`, hanya loopback `:3000`; Nginx satu-satunya gerbang publik dengan TLS.
- Dua role database: runtime tanpa DDL/TRUNCATE; migrasi lewat role owner terpisah (`MIGRATE_DATABASE_URL`).
- Media privat di `MEDIA_ROOT` (mode `0700`), pemindaian malware **fail-closed** — tanpa scanner, unggahan ditolak.
- HSTS aktif di produksi; `TRUST_PROXY=true` hanya aman karena Nginx loopback tepercaya.
- Jangan menjalankan seed/demo di production; database diisi via panel + bootstrap.
- Secret hanya di `/etc/wapala/production.env` (root, `0600`) dan GitHub Secrets — jangan pernah di-commit atau ke artifact.

## Troubleshooting

| Gejala | Periksa |
| --- | --- |
| Actions merah di tahap SSH | Secrets `VPS_HOST/PORT/USER/SSH_KEY/KNOWN_HOSTS`, kunci terpasang di `authorized_keys` |
| `Certbot gagal` saat provision | DNS/forwarding belum aktif, atau NAT tanpa forwarding publik `:80` → pakai `WAPALA_SKIP_CERTBOT=1` + DNS-01 |
| Build `Killed` | RAM kurang — lihat [Kapasitas](#kapasitas--build-hemat-memori) |
| Health check gagal lalu rollback | `journalctl -u wapala -n 100`; umumnya env/database salah |
| `503` saat unggah media | ClamAV tidak terpasang/mati — pasang via opsi provisioning atau periksa `clamav-daemon` |
| Halaman terbuka tapi aset 404 | Pastikan deploy melalui script (menyalin `.next/static` + `public` ke standalone) |

## Struktur branch `host`

```text
.github/workflows/deploy-host.yml   # Pemicu otomatis: push/manuel → SSH → host/host-deploy.sh
host/
  host-provision.sh                 # Provisioning sekali (paket, DB, env, systemd, Nginx, TLS)
  host-deploy.sh                    # Deploy berulang (clone, build, migrate, aktifkan, cek, rollback)
  wapala-host.service               # Unit systemd aplikasi
  nginx-wapala.conf                 # Nginx dedicated IP (80/443)
  nginx-wapala-nat.conf             # Nginx NAT VPS (port khusus provider)
  clamdscan-wapala.sh               # Wrapper scanner ClamAV
scripts/                            # Tool operasional: bootstrap, recovery, worker, backup
prisma/                             # Schema + migrations (tanpa seed)
src/ public/                        # Source aplikasi (dibutuhkan build)
README.md                           # Dokumen ini
```

Branch ini sengaja **hanya berisi kode deployment**: test, dokumen pengembangan, dan script dev berada di branch lain (`main`/`staging`), tidak di sini.
