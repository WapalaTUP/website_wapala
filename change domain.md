# Ganti domain WAPALA pada VPS NAT Hostdata

Target utama: **https://wapalatelkomuniversity.org**. Alias `www.wapalatelkomuniversity.org` diarahkan ke alamat utama. Domain sebelumnya diasumsikan `wapala-test.my.id`; cocokkan dengan server sebelum mengubahnya.

Dokumen ini adalah panduan untuk dijalankan sendiri oleh pengelola. Penyusunan dokumen tidak menjalankan SSH, mengganti DNS, atau mengubah VPS. Jangan menyalin seluruh dokumen sekaligus ke terminal: ada pilihan jalur, placeholder, dan pemeriksaan di setiap tahap.

## 1. Catat nilai server yang benar

| Nilai                     | Sumber                                                               |
| ------------------------- | -------------------------------------------------------------------- |
| IP publik NAT Hostdata    | Panel VPS/NAT Hostdata, bukan IP privat VPS atau IP Interserver lama |
| Port publik SSH           | Pemetaan SSH pada panel NAT                                          |
| Port internal HTTP Nginx  | Konfigurasi aktif Nginx dan Destination Port di panel NAT            |
| Port internal HTTPS Nginx | Konfigurasi aktif Nginx dan Destination Port di panel NAT            |
| Lokasi checkout Git       | Folder tempat biasanya menjalankan `host/wapala.sh`                  |
| Alamat email sertifikat   | Email pengelola yang aktif                                           |

Nilai `33335`/`33336` dalam template repo hanyalah contoh, bukan bukti port pada VPS sekarang. Port SSH, IP publik NAT, dan port internal belum diverifikasi dari VPS. Jangan memakai IP/port dari server sebelumnya tanpa mengeceknya.

Panduan Nginx di bawah memakai HTTPS yang diteruskan sampai Nginx di VPS. Jika Hostdata menghentikan TLS di proxy mereka, pastikan dahulu pengaturan sertifikat, protokol upstream, serta header `Host`/`X-Forwarded-Proto` dengan provider; jangan memaksakan konfigurasi TLS passthrough pada upstream HTTP.

## 2. Login SSH dan periksa instalasi

Jalankan dari komputer sendiri, ganti kedua placeholder:

```sh
ssh -p PORT_SSH_NAT codex@IP_PUBLIK_NAT
```

Masukkan password melalui prompt SSH, jangan menuliskannya ke dokumen atau perintah Git. Jika telanjur login sebagai root dan ingin berpindah ke akun codex:

```sh
su - codex
```

Perintah berikut dijalankan di VPS sebagai `codex`; `sudo` dipakai untuk administrasi:

```sh
whoami
hostname
sudo systemctl status wapala --no-pager -l
readlink -f /srv/wapala/current
sudo grep -E '^(APP_URL|NEXT_PUBLIC_SITE_URL|PORT|HOSTNAME|TRUST_PROXY)=' /etc/wapala/production.env
sudo nginx -T 2>/dev/null | grep -E 'configuration file|listen|server_name|ssl_certificate|acme-challenge|proxy_pass|proxy_set_header'
sudo ss -ltnp
sudo certbot certificates
```

Catat port yang benar, lokasi vhost aktif, serta jalur sertifikat lama. Default proyek menggunakan `/etc/nginx/sites-available/wapala.conf`, env `/etc/wapala/production.env`, dan service `wapala`. Jika instalasi berbeda, sesuaikan semua langkah berikut. Jangan menampilkan seluruh file env karena berisi secret.

## 3. Simpan konfigurasi awal dan backup

Simpan juga screenshot/ekspor DNS lama serta pemetaan NAT lama dari panel. Jangan hapus instalasi website lama sebelum domain baru terverifikasi.

```sh
DOMAIN_BACKUP="/root/wapala-domain-$(date +%Y%m%d-%H%M%S)"
sudo install -d -m 0700 "$DOMAIN_BACKUP"
sudo cp -a /etc/wapala/production.env "$DOMAIN_BACKUP/production.env"
sudo cp -a /etc/nginx/sites-available/wapala.conf "$DOMAIN_BACKUP/wapala.conf"
readlink -f /srv/wapala/current | sudo tee "$DOMAIN_BACKUP/active-release.txt"
printf 'Catat lokasi backup: %s\n' "$DOMAIN_BACKUP"
```

Variabel `DOMAIN_BACKUP` hanya tersedia pada sesi terminal ini. Catat jalur hasilnya untuk rollback. Backup env tetap di direktori root dengan akses terbatas; jangan commit atau unggah backup ke repo.

Di checkout repo, gunakan menu **5 — Backup database + media** sebelum deploy:

```sh
cd /PATH/CHECKOUT/Dev_Website
sudo bash host/wapala.sh
```

Ganti `/PATH/CHECKOUT/Dev_Website` dengan folder checkout aktual. Jika checkout langsung berisi `host/`, gunakan folder tersebut. Keluar dari menu setelah backup selesai. Perubahan domain sendiri tidak memerlukan migration, tetapi deploy kode terbaru bisa membawa migration yang tertunda. Staging dan main berbagi database; rollback kode tidak mengembalikan skema DB.

## 4. Setting panel NAT Hostdata

Pada panel yang mengatur routing domain/port VPS, buat pemetaan **untuk kedua hostname** berikut. Nama menu panel bisa berbeda; gunakan menu domain forwarding/reverse proxy NAT yang menyediakan Source Domain dan Destination Port.

| Source Domain                    | Layanan publik   | Tujuan                                          |
| -------------------------------- | ---------------- | ----------------------------------------------- |
| `wapalatelkomuniversity.org`     | HTTP publik 80   | VPS yang sama, port internal HTTP Nginx aktual  |
| `www.wapalatelkomuniversity.org` | HTTP publik 80   | VPS yang sama, port internal HTTP Nginx aktual  |
| `wapalatelkomuniversity.org`     | HTTPS publik 443 | VPS yang sama, port internal HTTPS Nginx aktual |
| `www.wapalatelkomuniversity.org` | HTTPS publik 443 | VPS yang sama, port internal HTTPS Nginx aktual |

Jika panel memakai satu entri domain untuk HTTP dan HTTPS, isi pasangan port di entri tersebut. Pertahankan header hostname/domain dan dukungan SNI sesuai metode routing provider. Jangan meneruskan trafik publik langsung ke port Node.js `3000`; arahkan melalui Nginx.

**A record tidak membawa informasi port.** Agar alamat dapat dibuka tanpa `:nomor-port`, provider harus menyediakan routing publik 80/443 yang sesuai. Jika hanya mendapat port publik tinggi dan tidak ada routing domain pada 80/443, mintalah routing tersebut ke Hostdata; mengganti DNS saja tidak menyelesaikannya.

Pertahankan mapping domain lama untuk sementara. Menambah domain pada DNS/DirectAdmin belum tentu otomatis mendaftarkannya pada routing NAT.

## 5. Setting DNS domain baru

Cek DNS aktif terlebih dahulu; jalankan di VPS jika `dig` tersedia:

Jika `dig: command not found`, pasang alat pemeriksaan dengan `sudo apt-get update` lalu `sudo apt-get install -y dnsutils`.

```sh
dig NS wapalatelkomuniversity.org +short
dig A wapalatelkomuniversity.org +short
dig AAAA wapalatelkomuniversity.org +short
dig CNAME www.wapalatelkomuniversity.org +short
dig MX wapalatelkomuniversity.org +short
dig CAA wapalatelkomuniversity.org +short
```

Edit zone di penyedia DNS yang ditunjuk nameserver aktif, bukan otomatis di tempat membeli VPS. Nameserver tidak perlu diganti jika zone aktif bisa diedit.

| Nama                                  | Tipe  | Isi                                            |
| ------------------------------------- | ----- | ---------------------------------------------- |
| `@` atau `wapalatelkomuniversity.org` | A     | IP publik NAT Hostdata yang sudah diverifikasi |
| `www`                                 | CNAME | `wapalatelkomuniversity.org.`                  |

Panel tertentu, termasuk setup DirectAdmin pada panduan repo, memakai nama domain lengkap alih-alih `@`. Hapus/ubah record web A/CNAME yang berbenturan hanya pada hostname yang dipindahkan. Jika AAAA masih menuju hosting lama dan VPS tidak memiliki layanan IPv6 untuk domain ini, hapus/ubah AAAA web tersebut juga.

**Pertahankan MX, SPF, DKIM, DMARC, dan record verifikasi.** Jika MX mengarah ke domain utama atau `mail` adalah CNAME ke domain utama, pastikan hostname email tetap mengarah ke server email yang benar sebelum memindahkan A web. Jangan ikut memindahkan email ke VPS aplikasi tanpa rencana terpisah.

Untuk Cloudflare, DNS only dapat dipakai sementara agar routing origin lebih mudah diperiksa. Jika proxy dipakai, sesuaikan akses origin dan gunakan Full (strict) setelah sertifikat origin valid. Jangan memakai Flexible. DNS provider lain tidak perlu mengikuti setting khusus Cloudflare.

Mengganti A domain organisasi yang sedang aktif akan memindahkan pengunjung dari website lama ke VPS ini. Lakukan saat siap cutover. Jika ingin menyiapkan SSL sebelum memindahkan A, gunakan jalur DNS-01 di bagian 7B.

Periksa hasil DNS dari resolver publik:

```sh
dig @1.1.1.1 wapalatelkomuniversity.org A +short
dig @8.8.8.8 wapalatelkomuniversity.org A +short
dig @1.1.1.1 www.wapalatelkomuniversity.org A +short
```

Saat DNS only, hasil harus menuju IP NAT. Jika Cloudflare proxy aktif, hasil berupa IP Cloudflare; cocokkan origin di panel DNS. Propagasi bergantung TTL/cache.

## 6. Siapkan hostname dan challenge HTTP di Nginx

```sh
sudo nano /etc/nginx/sites-available/wapala.conf
```

Pada blok WAPALA yang sudah ada, tambahkan hostname baru ke `server_name` sambil sementara mempertahankan hostname lama:

```nginx
server_name wapala-test.my.id wapalatelkomuniversity.org www.wapalatelkomuniversity.org;
```

Pastikan blok HTTP memiliki location ini. Pertahankan port `listen` internal aktual; jangan menggantinya dengan contoh repo:

```nginx
location /.well-known/acme-challenge/ {
    root /var/www/acme;
}
```

Letakkan redirect HTTP dalam `location /`, bukan `return` pada level `server` yang menutup jalur challenge. Jangan mengganti jalur sertifikat HTTPS sebelum sertifikat baru benar-benar tersedia. Pertahankan pengaturan rate limit, proxy, batas upload 60 MB, dan timeout yang sudah ada.

```sh
sudo nginx -t
```

Hanya jika hasilnya sukses:

```sh
sudo systemctl reload nginx
sudo install -d -m 0755 /var/www/acme/.well-known/acme-challenge
printf 'wapala-domain-check\n' | sudo tee /var/www/acme/.well-known/acme-challenge/wapala-domain-check
```

Uji dari jaringan luar VPS. Linux/macOS:

```sh
curl --fail --show-error http://wapalatelkomuniversity.org/.well-known/acme-challenge/wapala-domain-check
curl --fail --show-error http://www.wapalatelkomuniversity.org/.well-known/acme-challenge/wapala-domain-check
```

Di Windows PowerShell gunakan `curl.exe` menggantikan `curl`. Kedua respons harus berisi `wapala-domain-check`. Tes dari VPS sendiri bisa terpengaruh NAT loopback; hasil dari luar yang menentukan keterjangkauan publik.

## 7. Terbitkan sertifikat untuk domain utama dan www

Pilih **satu** jalur berikut. Jika `certbot` belum terpasang, pasang di VPS dengan `sudo apt-get update` lalu `sudo apt-get install -y certbot`.

### 7A. HTTP-01 melalui webroot — jika publik 80 sudah bekerja

Ganti `EMAIL_PENGELOLA` sebelum menjalankan:

```sh
sudo certbot certonly --webroot -w /var/www/acme \
  --cert-name wapalatelkomuniversity.org \
  -d wapalatelkomuniversity.org \
  -d www.wapalatelkomuniversity.org \
  --email EMAIL_PENGELOLA --agree-tos \
  --deploy-hook "systemctl reload nginx"
```

HTTP-01 selalu divalidasi melalui **port publik 80**; nomor port internal boleh berbeda karena NAT. Jika hanya satu hostname bekerja, perbaiki DNS/routing hostname lainnya sebelum meminta sertifikat untuk keduanya. Jika CAA membatasi penerbit, sesuaikan izin untuk Let's Encrypt. [Referensi challenge Let's Encrypt](https://letsencrypt.org/docs/challenge-types/).

### 7B. DNS-01 manual — bila publik 80 tidak tersedia atau SSL disiapkan sebelum cutover DNS

Jalur ini tidak membuat website otomatis terjangkau pada 443; pemetaan HTTPS NAT tetap diperlukan. Ganti email:

```sh
sudo certbot certonly --manual --preferred-challenges dns \
  --cert-name wapalatelkomuniversity.org \
  -d wapalatelkomuniversity.org \
  -d www.wapalatelkomuniversity.org \
  --email EMAIL_PENGELOLA --agree-tos
```

Ikuti prompt untuk menambahkan TXT pada `_acme-challenge.wapalatelkomuniversity.org` dan `_acme-challenge.www.wapalatelkomuniversity.org`. Gunakan nama/nilai persis yang diberikan Certbot, jangan mengarang nilai token. Cek sebelum menekan Enter:

```sh
dig @1.1.1.1 TXT _acme-challenge.wapalatelkomuniversity.org +short
dig @1.1.1.1 TXT _acme-challenge.www.wapalatelkomuniversity.org +short
```

**DNS-01 manual tidak otomatis diperpanjang oleh timer biasa.** Untuk pemakaian berkelanjutan, siapkan plugin DNS API/hook untuk penyedia DNS aktif, atau ulangi penerbitan manual sebelum sertifikat kedaluwarsa. Jangan menganggap timer Certbot saja sudah cukup pada jalur ini. [Referensi Certbot manual dan renewal](https://eff-certbot.readthedocs.io/en/stable/using.html#manual).

Setelah jalur yang dipilih berhasil:

```sh
sudo certbot certificates
sudo test -r /etc/letsencrypt/live/wapalatelkomuniversity.org/fullchain.pem
sudo test -r /etc/letsencrypt/live/wapalatelkomuniversity.org/privkey.pem
```

Gunakan jalur aktual yang dicetak Certbot jika berbeda. Jangan menampilkan isi private key.

## 8. Aktifkan HTTPS dan alamat utama

```sh
sudo nano /etc/nginx/sites-available/wapala.conf
```

Pada blok HTTPS aplikasi utama, ubah hanya nilai yang diperlukan:

```nginx
server_name wapalatelkomuniversity.org;
ssl_certificate /etc/letsencrypt/live/wapalatelkomuniversity.org/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/wapalatelkomuniversity.org/privkey.pem;
```

Pertahankan `listen` HTTPS internal yang sudah terverifikasi. Pada location proxy aplikasi, pertahankan `Host $host` dan `X-Forwarded-Proto $scheme` untuk jalur TLS sampai Nginx. Jangan menambahkan port internal NAT ke `APP_URL` atau redirect publik bila pengunjung masuk lewat publik 443.

Pisahkan `www` menjadi blok redirect. Ganti `PORT_HTTPS_INTERNAL` dengan angka yang telah dicatat; ini potongan konfigurasi, bukan perintah terminal:

```nginx
server {
    listen PORT_HTTPS_INTERNAL ssl http2;
    server_name www.wapalatelkomuniversity.org;
    ssl_certificate /etc/letsencrypt/live/wapalatelkomuniversity.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wapalatelkomuniversity.org/privkey.pem;
    return 301 https://wapalatelkomuniversity.org$request_uri;
}
```

Blok HTTP untuk domain utama dan www tetap menyediakan challenge. Pada `location /` gunakan:

```nginx
return 301 https://wapalatelkomuniversity.org$request_uri;
```

Hapus kedua hostname baru dari blok lain yang masih mendeklarasikannya, agar tidak ada konflik `server_name` pada port yang sama. Jangan menduplikasi deklarasi `limit_req_zone` dari template. Sesuaikan sintaks HTTP/2 dengan konfigurasi Nginx yang sudah berjalan bila versinya berbeda.

```sh
sudo nginx -t
```

Jika sukses:

```sh
sudo systemctl reload nginx
```

Jangan gunakan `curl -k` sebagai bukti HTTPS sukses; sertifikat harus valid tanpa melewati pemeriksaan TLS.

## 9. Ubah URL aplikasi dan build ulang

```sh
sudo nano /etc/wapala/production.env
```

Pastikan masing-masing key hanya satu kali dan berisi:

```dotenv
APP_URL=https://wapalatelkomuniversity.org
NEXT_PUBLIC_SITE_URL=https://wapalatelkomuniversity.org
```

Jangan ubah `DATABASE_URL`, `MIGRATE_DATABASE_URL`, `SECURITY_KEY`, kredensial SMTP, `MEDIA_ROOT`, atau port Node.js hanya karena pindah domain. `APP_URL` dipakai validasi Origin/CSRF; semua login/form publik harus melalui alamat utama yang sama.

```sh
sudo chmod 0600 /etc/wapala/production.env
sudo chown root:root /etc/wapala/production.env
sudo grep -E '^(APP_URL|NEXT_PUBLIC_SITE_URL)=' /etc/wapala/production.env
```

**Penting untuk script deploy pada repo ini:** env runtime dibaca systemd, tetapi `host/host-deploy.sh` belum otomatis memasukkan `NEXT_PUBLIC_SITE_URL` dari file env ke proses build. Berikan nilai publik ini secara eksplisit saat membuka menu deploy, termasuk pada deploy berikutnya:

```sh
cd /PATH/CHECKOUT/Dev_Website
git status --short --branch
git remote -v
```

Pastikan remote yang dipakai menuju `https://github.com/WapalaTUP/website_wapala.git`. Ganti `REMOTE_WAPALA` berikut dengan nama remote yang benar (`origin` atau `wapala`); jangan pull ke checkout yang masih mempunyai perubahan lokal tanpa meninjau perubahan tersebut:

```sh
git fetch REMOTE_WAPALA
git switch main
git pull --ff-only REMOTE_WAPALA main
sudo env NEXT_PUBLIC_SITE_URL=https://wapalatelkomuniversity.org bash host/wapala.sh
```

Di menu pilih **1 — Deploy ulang**, lalu pilih **main — production**. Tunggu proses install/build/migration/health check selesai; jangan membatalkan hanya karena build lama. Domain utama dan staging masih memakai DB bersama pada setup ini.

Alternatif noninteraktif, jika tidak memakai menu (pilih salah satu, jangan menjalankan dua deploy bersamaan):

```sh
sudo env WAPALA_BRANCH=main \
  NEXT_PUBLIC_SITE_URL=https://wapalatelkomuniversity.org \
  bash host/host-deploy.sh
```

`APP_URL` baru aktif saat service dimulai ulang oleh deploy. Ada jeda cutover ketika domain baru sudah menjawab tetapi aplikasi masih memakai Origin lama; hindari pengiriman formulir selama pergantian ini. Setelah selesai, login ulang di domain baru; cookie login domain lama tidak ikut berpindah. Env file jangan dijalankan dengan `source` hanya untuk build.

## 10. Verifikasi hasil dan sertifikat

Di VPS:

```sh
sudo systemctl status wapala --no-pager -l
sudo git -C /srv/wapala/current log -1 --oneline
sudo journalctl -u wapala --since "10 minutes ago" --no-pager -o cat | tail -n 80
curl --fail --show-error https://wapalatelkomuniversity.org/api/health
curl -I https://wapalatelkomuniversity.org/
curl -I https://www.wapalatelkomuniversity.org/
sudo certbot certificates
systemctl list-timers --all | grep -i certbot
```

`www` harus mengembalikan redirect ke `https://wapalatelkomuniversity.org/`, health harus sukses tanpa `-k`, dan sertifikat harus mencakup kedua nama. Ulangi akses dari jaringan luar VPS. Jika NAT loopback tidak didukung, kegagalan curl publik dari VPS perlu dibandingkan dengan pengujian dari luar.

Hanya jika memakai jalur HTTP-01/webroot yang otomatis:

```sh
sudo certbot renew --cert-name wapalatelkomuniversity.org --dry-run
```

Untuk DNS-01 manual, ikuti pengelolaan renewal bagian 7B; dry-run unattended bukan jaminan renewal bekerja.

Periksa lewat browser: halaman utama, `/wapala` untuk login, berita/divisi/album, autoplay/video, peminjaman/form publik, dan satu upload gambar/video. Periksa URL metadata/Open Graph melalui sumber HTML. Jika email dipakai, periksa link email baru dan fungsi pengiriman; perubahan URL aplikasi tidak mengharuskan mengganti penyedia email. Tautan email lama atau link yang sudah dibagikan masih memerlukan redirect domain lama.

Jangan membagikan log yang berisi data pribadi/secret. Health check saja tidak membuktikan login, email, dan upload bekerja.

## 11. Opsional: redirect domain lama setelah domain baru normal

Pertahankan DNS dan mapping NAT domain lama selama redirect diperlukan. Sertifikat lama harus tetap valid untuk redirect dari HTTPS; sertifikat domain baru di bagian 7 tidak mencakup domain lama.

Gunakan blok HTTP/HTTPS khusus `wapala-test.my.id` dengan port internal yang sama. Pertahankan location challenge HTTP agar renewal lama tetap bisa berjalan. Contoh berikut perlu diganti placeholder port dan dicocokkan dengan jalur sertifikat lama dari bagian 2:

```nginx
server {
    listen PORT_HTTP_INTERNAL;
    server_name wapala-test.my.id;
    location /.well-known/acme-challenge/ { root /var/www/acme; }
    location / { return 301 https://wapalatelkomuniversity.org$request_uri; }
}
server {
    listen PORT_HTTPS_INTERNAL ssl http2;
    server_name wapala-test.my.id;
    ssl_certificate /etc/letsencrypt/live/NAMA_SERTIFIKAT_LAMA/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/NAMA_SERTIFIKAT_LAMA/privkey.pem;
    return 301 https://wapalatelkomuniversity.org$request_uri;
}
```

Letakkan di file `wapala.conf` yang sama agar backup/rollback di bawah memulihkan semua blok sekaligus. Hapus blok lama yang mendeklarasikan hostname dan port yang sama sebelum menambahkan penggantinya. Jangan mengarahkan situs lama ke domain baru lalu domain baru kembali ke domain lama.

```sh
sudo nginx -t
```

Jika sukses:

```sh
sudo systemctl reload nginx
curl -I https://wapala-test.my.id/contoh?uji=1
```

Periksa `Location` mempertahankan path/query dan menuju domain utama yang baru.

## 12. Jika perlu membatalkan perubahan

Di panel, kembalikan **record DNS web dan mapping NAT yang tadi diubah** sesuai catatan sebelum cutover. Jangan mereset seluruh zone DNS atau record email. Propagasi DNS tidak langsung selesai; domain lama sebaiknya tetap tersedia selama proses.

Di VPS, isi jalur backup yang benar dari bagian 3. Lakukan sebelum deploy tambahan yang membawa perubahan env lain; jika sudah ada perubahan env lain sejak backup, gabungkan hanya perubahan domain secara manual agar konfigurasi baru tidak ikut tertimpa.

```sh
DOMAIN_BACKUP='/root/wapala-domain-TANGGAL-JAM-YANG-DICATAT'
sudo test -f "$DOMAIN_BACKUP/production.env"
sudo test -f "$DOMAIN_BACKUP/wapala.conf"
```

Jika kedua file ditemukan:

```sh
sudo cp -a "$DOMAIN_BACKUP/production.env" /etc/wapala/production.env
sudo cp -a "$DOMAIN_BACKUP/wapala.conf" /etc/nginx/sites-available/wapala.conf
sudo nginx -t
```

Jika konfigurasi lolos:

```sh
sudo systemctl reload nginx
sudo systemctl restart wapala
```

Itu mengembalikan origin runtime dan konfigurasi web. Metadata URL publik dalam build yang baru bisa masih memakai domain baru. Untuk mengembalikannya sepenuhnya, gunakan **menu 4 — Rollback** jika rilis sebelumnya memang masih memakai domain lama, atau build ulang melalui menu dengan `NEXT_PUBLIC_SITE_URL` berisi alamat utama lama yang dicatat. Contoh hanya jika alamat lama benar `https://wapala-test.my.id`:

```sh
cd /PATH/CHECKOUT/Dev_Website
sudo env NEXT_PUBLIC_SITE_URL=https://wapala-test.my.id bash host/wapala.sh
```

Periksa kembali health, login, DNS, dan TLS. Tidak perlu restore DB untuk perubahan domain ini. Jika deploy sebelumnya membawa migration, rollback kode tetap tidak membalikkan migration tersebut. Jangan menghapus sertifikat lama/baru saat troubleshooting.

## 13. Troubleshooting singkat

| Gejala                                           | Pemeriksaan                                                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Masih muncul website hosting lama                | NS/zone aktif, A/AAAA, cache DNS, Cloudflare, mapping Source Domain NAT                                       |
| Timeout pada domain tanpa port                   | Routing publik 80/443 belum tersedia/benar; A record tidak mengatur port                                      |
| Certbot HTTP-01 gagal                            | Kedua hostname, publik 80, location challenge, CAA, proxy provider                                            |
| Sertifikat salah                                 | Routing SNI/HTTPS NAT, `server_name`, sertifikat untuk utama dan www, Nginx belum reload                      |
| Redirect menuju `:33336` atau port internal lain | Ubah tujuan redirect menjadi `https://wapalatelkomuniversity.org$request_uri` jika publik 443 sudah dipetakan |
| Login/form ditolak                               | `APP_URL` lama, origin www belum redirect, service belum restart, proxy kehilangan Host/HTTPS                 |
| Metadata menuju localhost/domain lama            | `NEXT_PUBLIC_SITE_URL` tidak diteruskan saat build; deploy ulang dengan `sudo env` seperti bagian 9           |
| 502 Bad Gateway                                  | `systemctl status wapala`, log service, port upstream Nginx vs `PORT` env                                     |
| Renewal DNS manual gagal tanpa operator          | Perlu plugin DNS API/hook atau perpanjangan manual; timer saja tidak cukup                                    |

Konfigurasi yang dirujuk: `host/wapala.sh`, `host/host-deploy.sh`, `host/nginx-wapala-nat.conf`, `host/wapala-host.service`, `src/server/config.ts`, dan `src/app/layout.tsx`. Penelusuran memakai pembacaan sumber langsung karena antarmuka CodeGraph tidak tersedia pada checkout sesi ini. Panduan belum dieksekusi/diuji pada VPS.
