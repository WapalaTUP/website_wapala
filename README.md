# Website WAPALA — Production Deploy (`main`)

[![Deploy host](https://github.com/WapalaTUP/website_wapala/actions/workflows/deploy-host.yml/badge.svg?branch=main)](https://github.com/WapalaTUP/website_wapala/actions/workflows/deploy-host.yml)
[![CI host](https://github.com/WapalaTUP/website_wapala/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/WapalaTUP/website_wapala/actions/workflows/ci.yml)

Branch **`main`** adalah sumber deployment production Website WAPALA — situs resmi unit kegiatan mahasiswa Wahana Pencinta Alam Telkom University (Gunung & Hutan, Rock Climbing, Caving, Rafting). Branch `host` dipakai sebagai **development**; rilis masuk `main` lewat merge. Situs aktif development: [wapala.my.id](https://wapala.my.id).

Satu alur untuk semua VPS: **clone branch `main` di server → jalankan satu perintah setup → jalankan satu perintah deploy → live.** Deploy ulang berikutnya cukup jalankan lagi perintah deploy. Deploy otomatis via GitHub Actions tersedia sebagai opsional (lihat [Langkah 4](#langkah-4--opsional-deploy-otomatis-dari-push)).

> 📖 **Walkthrough nyata end-to-end** (InterServer KVM Slice 1 + domain hostdata.id/DirectAdmin, termasuk setting nameserver, ClamAV, dan semua jebakan yang kami temui): [host/deploy-walkthrough.md](host/deploy-walkthrough.md)

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

### Membaca panel provider (Domain Forwarding + DNS) → parameter provisioning

Nilai di panel **berubah tergantung VPS** — selalu cek panel VPS yang akan dipakai, jangan asal pakai catatan lama. Pola penerjemahannya:

| Baris di panel provider | Arti | Parameter provisioning |
| --- | --- | --- |
| `HTTP  domain:80  → IP_internal:33335` | Trafik HTTP publik masuk ke nginx internal `33335` | `WAPALA_NAT_HTTP_PORT=33335` |
| `HTTPS domain:443 → IP_internal:33336` | Trafik HTTPS publik masuk ke nginx internal `33336` | `WAPALA_NAT_HTTPS_PORT=33336` |
| Baris `HTTPS`, kolom **Source Port** | Port publik yang dipakai browser (`443` atau custom) | `WAPALA_NAT_PUBLIC_HTTPS_PORT=443` — isi hanya bila beda dari port internal; bila `443`, redirect otomatis bersih tanpa `:port` |
| `TCP  IP_publik:33333 → IP_internal:22` | SSH dari luar | SSH manual: `ssh -p 33333 user@IP_publik`; (mode otomatis) secret `VPS_PORT=33333` |
| DNS `A  domain → 185.x.x.x` | Domain sudah menunjuk IP publik provider | Syarat certbot — verifikasi `dig +short domain` |

Contoh (**ilustrasi** — ganti dengan nilai panel VPS yang akan dipakai). Panel menampilkan:

```text
HTTP   mysite.com  80  → 10.x.x.x  33335
HTTPS  mysite.com  443 → 10.x.x.x  33336
TCP    185.x.x.x  33333 → 10.x.x.x  22
DNS:   A  mysite.com → 185.x.x.x
```

Perintah provisioning-nya:

```sh
sudo WAPALA_NAT_MODE=1 \
     WAPALA_NAT_HTTP_PORT=33335 \
     WAPALA_NAT_HTTPS_PORT=33336 \
     WAPALA_NAT_PUBLIC_HTTPS_PORT=443 \
     bash host/host-provision.sh mysite.com email@kamu.com
```

Checklist sebelum jalan: (1) A record menunjuk IP publik provider, (2) domain terdaftar di baris forwarding HTTP **dan** HTTPS, (3) port internal di parameter sama persis dengan kolom Destination Port, (4) ini panel VPS tujuan — bukan VPS production lama yang masih hidup.

---

## Langkah 1 — Provisioning (sekali saja)

SSH ke VPS, lalu clone branch `host` dan jalankan provisioning:

```sh
apt-get update && apt-get install -y git
git clone --branch main --single-branch https://github.com/WapalaTUP/website_wapala.git wapala-setup
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

## Langkah 4 — Opsional: deploy otomatis dari push

Lewati langkah ini bila cukup dengan deploy manual (Langkah 5). Untuk mode "push → server ter-update sendiri", buat kunci SSH khusus deploy (di mesin lokal), tanpa passphrase agar otomatis:

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
| `VPS_KNOWN_HOSTS` | ✅ | Output `ssh-keyscan` — wajib; tanpa ini deploy ditolak agar tidak rentan MITM |
| `VPS_REPO_URL` | repo private | URL clone + kredensial/deploy key bila repo tidak publik |

## Langkah 5 — Deploy

Deploy pertama dan semua deploy berikutnya, dari folder clone di VPS:

```sh
sudo bash host/host-deploy.sh
```

Script otomatis: clone release baru dari repo (default `https://github.com/WapalaTUP/website_wapala.git`, bisa diganti `WAPALA_REPO_URL=...`) → `npm ci` + `next build` dengan heap terbatas → `prisma migrate deploy` → aktifkan via symlink atomik → restart service → health check → rollback bila gagal. Pantau progres langsung di terminal.

Verifikasi setelah selesai:

```sh
curl -fsS https://contoh-domain.com/api/health
```

Bila memakai mode otomatis (Langkah 4), deploy juga terpicu tombol **Actions → Deploy host → Run workflow**; log tahapan yang sama tampil di tab Actions.

## Langkah 6 — Bootstrap Super User

```sh
sudo sh -c 'set -a; . /etc/wapala/production.env; set +a; cd /srv/wapala/current; npm run auth:bootstrap-token'
```

Token sekali pakai berlaku 30 menit — buka `https://contoh-domain.com/wapala` dan buat akun Super User. Tidak ada password bawaan; setup sudah selesai tidak perlu diulang.

### Pemulihan akses (via SSH)

Bila Super User lupa password **atau** terkunci login (6+ gagal → `requiresUnlock`), pulihkan lewat SSH — password diminta lewat prompt tersembunyi, bukan argumen:

```sh
sudo sh -c 'set -a; . /etc/wapala/production.env; set +a; cd /srv/wapala/current; npm run auth:recover-superuser'
```

Perintah ini membuka lock (`lockUntil`, `requiresUnlock`), mencabut semua sesi aktif, dan menyiapkan penggantian password. Untuk **akun selain Super User**: reset password dan unlock dilakukan Super User lewat panel (modul Pengguna → aksi Reset/Unlock) — tidak perlu SSH. Karena `EMAIL_MODE=disabled`, jalur reset via email tidak tersedia.

---

## Operasional harian

| Kebutuhan | Perintah |
| --- | --- |
| Deploy rilis baru | `sudo bash host/host-deploy.sh` (atau Run workflow bila mode otomatis aktif) |
| Deploy manual dengan repo lain | `sudo WAPALA_REPO_URL=https://... bash host/host-deploy.sh` |
| Log aplikasi | `journalctl -u wapala -f` |
| Status service | `systemctl status wapala` |
| Log maintenance | `journalctl -u wapala-maintenance.service -n 50` |
| Rollback manual | `sudo ln -sfn /srv/wapala/releases/ID_LAMA /srv/wapala/current && sudo systemctl restart wapala` |
| Backup database+media | `sudo node scripts/release-backup.mjs backup /root/backup-$(date +%F)` |
| Migration manual | `sudo sh -c 'set -a; . /etc/wapala/production.env; set +a; cd /srv/wapala/current; npm run db:migrate'` |
| Prune manual (throttle/sesi) | `sudo sh -c 'set -a; . /etc/wapala/production.env; set +a; cd /srv/wapala/current; npm run maintenance:prune'` |

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

- Aplikasi non-root (`wapala`), `ProtectSystem=strict` + sandbox systemd (kernel/devices/syscalls dibatasi), hanya loopback `:3000`; Nginx satu-satunya gerbang publik dengan TLS.
- **Kode release milik `root`**; runtime hanya boleh menulis `.next/cache` dan media — kompromi aplikasi tidak bisa menimpa kode yang akan dieksekusi ulang.
- **Build/migration berjalan sebagai user non-root `builder`**; install script dependensi tidak pernah dieksekusi sebagai root.
- **Lockout login per (email, IP)**: 6× password salah → terkunci 24 jam untuk kombinasi itu saja; akun tidak bisa dikunci permanen oleh pihak ketiga. Unlock: panel admin (modul Pengguna) atau `auth:recover-superuser` via SSH.
- Dua role database: runtime tanpa DDL/TRUNCATE; migrasi lewat role owner terpisah (`MIGRATE_DATABASE_URL`); password DB tidak pernah lewat argv proses.
- Media privat di `MEDIA_ROOT` (mode `0700`), pemindaian malware **fail-closed** dan dijalankan **sebelum** decode; serving media lewat stream + ETag/304 (tanpa memuat berkas penuh ke RAM).
- Env file dibaca deploy script baris-per-baris tanpa shell eval — nilai berisi `& $ ' ` aman.
- Rate limit Nginx untuk `/api/auth` (30/menit) dan `/api/public` (120/menit) berlaku sebelum request menyentuh Node.
- Timer `wapala-maintenance` (03:17 harian) membersihkan throttle, sesi kadaluarsa, dan token reset — tidak bergantung pada `EMAIL_MODE`.
- HSTS aktif di produksi; `TRUST_PROXY=true` hanya aman karena Nginx loopback tepercaya.
- Jangan menjalankan seed/demo di production; database diisi via panel + bootstrap.
- Secret hanya di `/etc/wapala/production.env` (root, `0600`) dan GitHub Secrets — jangan pernah di-commit atau ke artifact.
- CI ringan (`ci.yml`: typecheck + lint + build) jalan tiap push ke `host`; jalankan deploy setelah CI hijau.

## Troubleshooting

| Gejala | Periksa |
| --- | --- |
| CI merah sebelum deploy | Log workflow `CI host` — typecheck/lint/build gagal; perbaiki dulu sebelum deploy |
| Actions merah di tahap SSH | Secrets `VPS_HOST/PORT/USER/SSH_KEY/KNOWN_HOSTS` (semua wajib), kunci terpasang di `authorized_keys` |
| `Certbot gagal` saat provision | DNS/forwarding belum aktif, atau NAT tanpa forwarding publik `:80` → pakai `WAPALA_SKIP_CERTBOT=1` + DNS-01 |
| Build `Killed` | RAM kurang — lihat [Kapasitas](#kapasitas--build-hemat-memori) |
| Health check gagal lalu rollback | `journalctl -u wapala -n 100`; umumnya env/database salah. Ingat: migration sudah jalan (expand/contract) |
| `423` saat login | Lock per (email, IP) aktif (6× salah, 24 jam) — tunggu, unlock via panel admin, atau `auth:recover-superuser` via SSH |
| `429 MEDIA_BUSY` saat upload | Antrean slot upload penuh — coba beberapa saat; slot publik dan admin terpisah |
| `503` saat unggah media | ClamAV tidak terpasang/mati — pasang via opsi provisioning atau periksa `clamav-daemon` |
| `413` saat unggah buku | Pastikan ≤ 50 MB dan nginx `client_max_body_size 60m` aktif |
| Halaman terbuka tapi aset 404 | Pastikan deploy melalui script (menyalin `.next/static` + `public` ke standalone) |

## Struktur repository (`main`)

```text
.github/workflows/deploy-host.yml   # Opsional: Run workflow → SSH → host/host-deploy.sh
.github/workflows/ci.yml            # Gate: typecheck + lint + build tiap push ke host
host/
  host-provision.sh                 # Provisioning sekali (paket, DB, env, systemd, Nginx, TLS)
  host-deploy.sh                    # Deploy berulang (clone, build non-root, migrate, aktifkan, cek, rollback)
  wapala-host.service               # Unit systemd aplikasi (sandbox ketat)
  wapala-maintenance.service/.timer # Prune harian throttle/sesi/token
  nginx-wapala.conf                 # Nginx dedicated IP (80/443)
  nginx-wapala-nat.conf             # Nginx NAT VPS (port khusus provider)
  clamdscan-wapala.sh               # Wrapper scanner ClamAV
scripts/                            # Tool operasional: bootstrap, recovery, worker, backup, prune
prisma/                             # Schema + migrations (tanpa seed)
src/ public/                        # Source aplikasi (dibutuhkan build)
README.md                           # Dokumen ini
```

Branch ini sengaja **hanya berisi kode deployment**: test, dokumen pengembangan, dan script dev tidak dibawa ke sini. Pengembangan harian terjadi di branch `host`.
