# Walkthrough Deploy Nyata — InterServer KVM + Domain hostdata.id

Dokumen ini adalah **catatan deployment yang benar-benar dijalankan** (Oktober 2026):
VPS **InterServer KVM Linux VPS Slice 1** (1 vCPU, 1.9 GB RAM + 1 GB swap, 38 GB disk,
Ubuntu 24.04.5), akses SSH memakai user non-root `codex`, dan domain
`wapala-test.my.id` yang DNS-nya dikelola di panel hostdata.id (DirectAdmin).
Total waktu dari SSH kosong sampai upload buku berhasil: ±1 jam.

Panduan konsep/arsitektur ada di [README](../README.md); dokumen ini fokus **urutan
perintah persis seperti yang dieksekusi**, termasuk jebakan yang kami temui.

---

## 0. Cek awal (setelah SSH masuk)

```sh
cat /etc/os-release | head -2   # target: Ubuntu 22.04/24.04
free -h                         # butuh >= 2 GB RAM (1.9 GB + swap 1 GB cukup)
df -h /                         # butuh >= 3 GB bebas
sudo -v                         # pastikan user punya sudo
```

**Jika `sudo -v` gagal** (`user codex may not run sudo`) — user belum masuk group sudo:

```sh
su -                            # masukkan password root (panel provider: VPS → Root Password)
usermod -aG sudo codex
exit && exit                    # keluar dari root DAN sesi SSH
# login ulang via SSH, lalu:
sudo -v                         # harus sukses
```

> Kebingungan yang kami temui: `free -h` di Slice 1 menampilkan total 1.9 Gi —
> itu cukup. Build sudah dibatasi heap 512/768 MB oleh `host/host-deploy.sh`.

## 1. Clone branch `host`

```sh
sudo apt-get update && sudo apt-get install -y git
git clone --branch host --single-branch https://github.com/WapalaTUP/website_wapala.git wapala-setup
cd wapala-setup
```

## 2. Domain dan nameserver (atur sebelum provisioning jika ingin TLS otomatis)

### 2a. Tentukan IP VPS

```sh
curl -s ifconfig.me             # contoh hasil: 157.250.195.236
```

⚠️ **Selalu verifikasi dengan perintah ini** — jangan menyalin IP dari tempat lain.
IP yang salah = sertifikat Let's Encrypt gagal dan domain mengarah ke server orang lain.

### 2b. Keputusan nameserver: ganti atau tidak?

Cek dulu delegasi yang aktif (dari mesin lokal, atau via https://dnschecker.org):

```sh
# Linux/Mac (di mesin lokal):
dig NS wapala-test.my.id +short
# Windows PowerShell:
Resolve-DnsName wapala-test.my.id -Type NS
```

| Kondisi | Tindakan |
| --- | --- |
| NS **sudah** mengarah ke tempat kamu mengelola DNS (mis. `ns21-ns24.hostdata.id`) dan zone bisa diedit | **SKIP — jangan ganti nameserver.** Cukup tambah A record di zone itu |
| NS mengarah ke provider lain, tapi kamu ingin DNS dikelola provider VPS (mis. `cdns1.interserver.net`) | Ganti NS di panel registrar, **tunggu delegasi menyebar**, lalu buat ulang A record di panel DNS provider VPS |
| Zone belum ada di mana pun | Daftarkan domain ke panel hosting (DirectAdmin → Domain Setup → Add Domain) atau aktifkan DNS management di registrar |

> Saran praktis: **mengganti NS menambah tungguan jam-jaman tanpa manfaat** kalau
> zone existing sudah bisa diedit. Kasus kami: NS tetap `hostdata.id`, A record
> ditambah di sana — selesai dalam hitungan menit. Saran "pakai cdns.interserver.net"
> dari provider itu opsional, bukan wajib.

### 2c. Tambah A record (panel DirectAdmin hostdata)

Form **Add Record** DirectAdmin **menolak `@`** — pakai nama domain lengkap:

| Record Name | Type | Value |
| --- | --- | --- |
| `wapala-test.my.id` | A | IP VPS dari langkah 2a |
| `www` | CNAME | `wapala-test.my.id.` (dengan titik) |

**Verifikasi dari sisi otoritatif** (propagasi publik bisa menunggu cache negatif):

```sh
# cari NS otoritatif dulu jika belum tahu:
dig NS wapala-test.my.id
# langsung tanya ke NS-nya:
dig @ns21.hostdata.id wapala-test.my.id A +short    # harus mencetak IP VPS
```

Domain yang dipakai untuk VPS baru **jangan** domain yang sedang menjadi situs
live production — pakai subdomain (mis. `v2.domain.com`) untuk pengujian.

## 3. Provisioning (sekali, idempoten)

Jika domain belum siap saat pertama, provisioning bisa dijalankan dulu dengan
placeholder, lalu **dijalankan ulang** — user/database/direktori akan dilewati:

```sh
# Jaluran pertama (belum ada domain):
sudo WAPALA_ENABLE_UFW=1 WAPALA_SKIP_CERTBOT=1 bash host/host-provision.sh test.local ops@test.local

# Setelah domain + A record aktif — jalankan ulang (idempoten):
sudo WAPALA_ENABLE_UFW=1 bash host/host-provision.sh wapala-test.my.id ops@wapala-test.my.id
```

Yang dilakukan script: paket sistem + Node.js 24, PostgreSQL + dua role
(`wapala` owner untuk migrate, `wapala_app` runtime terbatas), user layanan
`wapala` + user build non-root `builder`, env file `0600`, unit systemd,
Nginx HTTP → **certbot Let's Encrypt** → Nginx HTTPS, timer maintenance.

📌 **Catat password DB yang tercetak** di ringkasan akhir.

Output sukses (ringkas):

```text
================= PROVISIONING SELESAI =================
Mode         : Dedicated IP (80/443)
Domain       : https://wapala-test.my.id
...
Password DB  : runtime=(sudah ada) owner=(sudah ada)   <- idempoten bekerja
Builder      : user non-root 'builder'
Maintenance  : wapala-maintenance.timer 03:17
ClamAV       : TIDAK (upload ditolak sampai dipasang)
```

### 3a. WAJIB jika pernah provisioning dengan placeholder

`APP_URL` tidak ditimpa provisioning ulang — perbaiki manual:

```sh
sudo sed -i 's|^APP_URL=.*|APP_URL=https://wapala-test.my.id|' /etc/wapala/production.env
sudo grep APP_URL /etc/wapala/production.env          # verifikasi (pakai sudo — file 0600)
sudo chmod 0600 /etc/wapala/production.env && sudo chown root:root /etc/wapala/production.env
```

## 4. Deploy pertama

```sh
sudo bash host/host-deploy.sh
```

Build di 1 vCPU butuh **10-20 menit** — jangan di-cancel. Sukses ditandai:

```text
[wapala-deploy] All migrations have been successfully applied.
[wapala-deploy] Menerapkan grant ulang untuk role runtime 'wapala_app' di db 'wapala'...
[wapala-deploy] Aktif: /srv/wapala/current -> /srv/wapala/releases/20261016-053534
[wapala-deploy] DEPLOY SELESAI: ... (HEAD b0f7c8b)
```

Verifikasi:

```sh
curl -fsS https://wapala-test.my.id/api/health
# {"status":"ok","requestId":"..."}
```

## 5. Buat akun Super User

```sh
sudo sh -c 'set -a; . /etc/wapala/production.env; set +a; cd /srv/wapala/current; npm run auth:bootstrap-token'
```

Token tampil sekali (30 menit) → buka `https://wapala-test.my.id/wapala` → buat akun
Super User → wajib ganti password saat login pertama.

### Smoke test minimum

1. Login panel + ganti password.
2. Buka beberapa modul admin (anggota, inventaris, konten).
3. Buka halaman publik — aset termuat.
4. Upload media → **ditolak 503 sampai ClamAV terpasang** (fail-closed by design) → lanjut bagian 6.

## 6. Pasang ClamAV (agar upload aktif)

⚠️ clamd makan ~1-1.5 GB RAM sendiri. Di VPS 2 GB bersama app + PostgreSQL ia akan
menyentuh swap. Pantau dengan `free -h`; bila available sering < 200 MB, pilih
tanpa ClamAV (upload tetap mati) atau upgrade VPS.

```sh
# 1) Paket
sudo apt-get install -y clamav clamav-daemon clamav-freshclam

# 2) Signature penuh (5-15 menit)
sudo systemctl stop clamav-freshclam 2>/dev/null; sudo freshclam
sudo systemctl enable --now clamav-freshclam

# 3) Izinkan scan hingga 60 MB (default clamd 25M — buku app 50 MB)
echo 'StreamMaxLength 60M' | sudo tee -a /etc/clamav/clamd.conf
sudo systemctl restart clamav-daemon
sleep 60 && systemctl is-active clamav-daemon

# 4) Wrapper scanner — /usr/local/libexec TIDAK ADA di Ubuntu 24.04, buat dulu:
sudo mkdir -p /usr/local/libexec
sudo install -m 0755 ~/wapala-setup/host/clamdscan-wapala.sh /usr/local/libexec/clamdscan-wapala
command -v clamdscan        # harus: /usr/bin/clamdscan

# 5) Aktifkan MEDIA_SCANNER di env aplikasi (grep wajib sudo — file 0600)
sudo sed -i 's|^# MEDIA_SCANNER=.*|MEDIA_SCANNER=/usr/local/libexec/clamdscan-wapala|' /etc/wapala/production.env
sudo grep MEDIA_SCANNER /etc/wapala/production.env
sudo chmod 0600 /etc/wapala/production.env && sudo chown root:root /etc/wapala/production.env

# 6) Beri akses socket clamd ke user aplikasi + restart
sudo sed -i 's|^Group=wapala$|Group=wapala\nSupplementaryGroups=clamav|' /etc/systemd/system/wapala.service
sudo systemctl daemon-reload && sudo systemctl restart wapala

# 7) Uji: file bersih → exit=0
sudo -u wapala /usr/local/libexec/clamdscan-wapala --no-summary --infected -- /etc/hostname; echo "exit=$?"

# 8) Uji malware dummy (EICAR) → exit=1
printf 'X5O!P%%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' > /tmp/eicar.txt
sudo -u wapala /usr/local/libexec/clamdscan-wapala --no-summary --infected -- /tmp/eicar.txt; echo "exit=$?"
rm /tmp/eicar.txt

# 9) Kondisi RAM setelah clamd jalan
free -h && journalctl -k | grep -i oom | tail -3
```

Hasil yang kami dapat: `exit=0`, `FOUND ... exit=1`, available 518 Mi — sehat.
Setelah itu **upload buku 50 MB via panel langsung sukses** (uji terberat: nginx
60m → multipart hemat RAM → scan file mentah → decode → checksum → register DB).

## 7. Verifikasi SSL (biasanya sudah otomatis)

Sertifikat Let's Encrypt terpasang saat provisioning (tahap "Mengaktifkan
konfigurasi HTTPS penuh" muncul **setelah** certbot sukses). Bukti cepat:
`curl -fsS https://domain/api/health` sukses **tanpa** `-k` = sertifikat tepercaya.

```sh
echo | openssl s_client -connect wapala-test.my.id:443 -servername wapala-test.my.id 2>/dev/null | openssl x509 -noout -issuer -dates
sudo certbot certificates
systemctl list-timers | grep -i certbot      # perpanjangan otomatis tiap 90 hari
```

## 8. Operasional harian

| Kebutuhan | Perintah |
| --- | --- |
| Deploy rilis baru | `sudo bash host/host-deploy.sh` |
| Log aplikasi | `journalctl -u wapala -f` |
| Log maintenance | `journalctl -u wapala-maintenance.service -n 50` |
| Rollback manual | `sudo ln -sfn /srv/wapala/releases/ID_LAMA /srv/wapala/current && sudo systemctl restart wapala` |
| Backup sebelum eksperimen | `sudo node scripts/release-backup.mjs backup /root/backup-$(date +%F)` |
| Pemulihan Super User | `sudo sh -c 'set -a; . /etc/wapala/production.env; set +a; cd /srv/wapala/current; npm run auth:recover-superuser'` |

## 9. Jebakan yang kami temui (dan solusinya)

| Gejala | Penyebab | Solusi |
| --- | --- | --- |
| `Sorry, user codex may not run sudo` | User baru belum di group sudo | `su -` → `usermod -aG sudo codex` → **login ulang** |
| `Record name @ must not contain special characters` | DirectAdmin menolak `@` | Pakai nama domain lengkap: `wapala-test.my.id` |
| `install: cannot create ... /usr/local/libexec/...` | Folder tidak ada di Ubuntu 24.04 | `sudo mkdir -p /usr/local/libexec` dulu |
| `grep: /etc/wapala/production.env: Permission denied` | File root-only `0600` (by design) | Selalu `sudo grep ...` |
| DNS tidak terlihat dari resolver publik padahal record dibuat | Cache negatif + propagasi | Cek langsung ke NS otoritatif: `dig @ns21.hostdata.id domain A +short` |
| Satu NS menjawab "name does not exist", tiga lainnya benar | Sinkronisasi antar-NS tertinggal | Tunggu; yang penting mayoritas NS + otoritatif sudah benar |
| IP terlihat seperti rentang aneh (mis. Google) | Salah salin IP | **Selalu** `curl -s ifconfig.me` di VPS sebagai sumber kebenaran |
| App `503 CONFIG_INVALID` via IP tanpa TLS | Production mewajibkan `APP_URL` https | Pakai domain + certbot, bukan akses via IP http |
