# Mengurangi penggunaan RAM selama deploy

Hostdata memakai RAM 2 GB, 1 vCPU, tanpa swap. `host/host-deploy.sh` menghentikan sementara layanan pendukung sebelum install/build dan memeriksa `MemAvailable`. Pengurangan beban ini membantu mengurangi risiko OOM, bukan jaminan semua build akan muat atau menjadi cepat. Website, Nginx, PostgreSQL, dan SSH tetap berjalan.

## Layanan yang dipause

- Timer email dan maintenance WAPALA dihentikan lebih dahulu agar tidak memulai pekerjaan baru.
- Worker email dan maintenance yang sedang berjalan dihentikan sementara.
- `clamav-freshclam.service`, `clamav-daemon.socket`, dan `clamav-daemon.service` dihentikan. Socket ikut dihentikan agar akses pemindaian tidak mengaktifkan daemon kembali lewat socket.
- Unit yang tidak terpasang dilewati. Status aktif dicatat sebelum operasi stop; hanya unit yang sebelumnya aktif/activating/reloading yang dimulai ulang. Pengaturan enable/disable dan mask tidak diubah.

Selama jeda, upload yang memerlukan pemindaian ditolak sementara karena pemeriksaan tetap fail-closed; email/maintenance tertunda. Hindari upload selama proses deploy. Tidak ada `pkill node`, penghentian database, penghapusan cache kernel, atau upaya memasang swap pada Hostdata.

## Kapan layanan dipulihkan

Setelah health check dan pekerjaan deploy selesai, scanner dipulihkan sebelum worker/timer. Kegagalan install, generate, build, migration, health check, serta sinyal INT/TERM/HUP yang ditangani shell juga menjalankan pemulihan melalui EXIT trap. Kode kegagalan deploy dipertahankan. Jika pemulihan unit gagal, deploy melaporkan kegagalan dan menyimpan unit yang perlu dipulihkan secara manual.

SIGKILL, OOM yang membunuh shell deploy itu sendiri, atau kehilangan daya tidak dapat ditangani trap. Untuk itu daftar awal unit aktif disimpan **sebelum stop pertama** pada `/srv/wapala/.deploy-paused-services` (mode 600). File dihapus setelah pemulihan lengkap. Deploy berikutnya menolak berjalan jika file pemulihan lama masih ada, agar keadaan sebelumnya tidak tertimpa.

Pengunci `flock` pada `/srv/wapala/.deploy.lock` mencegah deploy main/staging bersamaan pada base directory yang sama. Pengunci diperoleh sebelum pause/prune, sehingga deploy kedua tidak memulihkan atau menghentikan layanan milik deploy pertama. Jalur mengikuti `WAPALA_BASE_DIR` jika diubah.

## Pemeriksaan RAM dan konfigurasi

`MemAvailable` diperiksa setelah pause dan sekali lagi sebelum `next build`. Default minimum adalah 1024 MB. Jika kurang, deploy berhenti dan memulihkan layanan; jangan langsung menaikkan heap pada VPS kecil. Heap Node bukan batas total seluruh proses Next.js/native worker.

| Variabel | Default | Arti |
| --- | --- | --- |
| `WAPALA_PAUSE_BACKGROUND` | `1` | Pause layanan pendukung; `0` untuk tidak melakukan pause |
| `WAPALA_MIN_BUILD_AVAILABLE_MB` | `1024` | Ambang RAM tersedia sebelum proses build; bukan jaminan peak memory |
| `WAPALA_HEAP_BUILD` | `768` | Batas heap Node saat build, pengaturan lama tetap dipertahankan |

Alur deploy biasa lewat menu 1 otomatis memakai penghematan ini, **setelah script pada checkout di-pull**. Script dipanggil dari checkout yang menjalankan menu; update repo saja belum mengganti website aktif. Untuk alur Hostdata main:

```sh
git status --short --branch
git remote -v
```

Pastikan checkout bersih dan remote menuju WapalaTUP, lalu pull main menggunakan nama remote yang benar. Buka menu:

```sh
sudo env NEXT_PUBLIC_SITE_URL=https://wapalatelkomuniversity.org bash host/wapala.sh
```

Gunakan domain aktif sebenarnya jika perpindahan ke domain organisasi belum dilakukan. Pilih menu 1 lalu main. Pengaturan URL publik di atas diperlukan oleh proses build pada script saat ini; jangan mengubah `APP_URL` jika domain belum dipindah. Mode penghematan ini tidak membawa migration baru, tetapi deploy kode terbaru tetap dapat membawa migration sebelumnya yang tertunda. Staging/main berbagi DB; backup tetap mengikuti alur yang sudah ada.

## Verifikasi di VPS

Pengujian tidak dijalankan di komputer lokal dan tidak ada SSH yang dilakukan oleh agen. Pemeriksaan format/diff dilakukan lokal. Jalankan di checkout VPS:

```sh
bash -n host/host-deploy.sh
bash -n host/test-deploy-resources.sh
bash host/test-deploy-resources.sh
```

Harness menggunakan fungsi `systemctl` palsu, tabel status dalam memori dan file sementara. Ia tidak memanggil systemd asli, menginstal paket, menyentuh DB, atau memerlukan sudo/npm. Yang diperiksa: status aktif/inaktif awal, unit tidak ada, opt-out, urutan pause/pemulihan, pemulihan parsial gagal, retry, ambang RAM, dan EXIT trap yang menjaga exit code kegagalan. Verifikasi deploy sungguhan tetap diperlukan setelah tes terisolasi ini.

Saat deploy sebenarnya, log seharusnya menunjukkan `Pause sementara`, `RAM tersedia`, dan `Pulihkan layanan`. Setelah deploy periksa:

```sh
free -h
sudo systemctl status wapala --no-pager -l
sudo systemctl is-active clamav-daemon.service clamav-daemon.socket clamav-freshclam.service
sudo systemctl is-active wapala-email.timer wapala-maintenance.timer
sudo test ! -e /srv/wapala/.deploy-paused-services
```

Unit yang awalnya tidak aktif boleh tetap tidak aktif. Periksa hasil terhadap keadaan sebelum deploy, bukan menganggap semua unit wajib aktif.

## Pemulihan setelah deploy terputus keras

Hanya jika deploy sudah berhenti; jangan menjalankan recovery saat build masih hidup. Periksa daftar:

```sh
sudo cat /srv/wapala/.deploy-paused-services
```

Untuk base directory default, perintah ini memperoleh lock yang sama, memulihkan hanya daftar tersimpan dalam urutan terbalik, dan menghapus file hanya jika seluruh start sukses:

```sh
sudo flock -n /srv/wapala/.deploy.lock bash -c '
  set -euo pipefail
  state=/srv/wapala/.deploy-paused-services
  [ -f "$state" ] || exit 0
  while IFS= read -r unit; do
    [ -n "$unit" ] || continue
    systemctl start "$unit"
  done < <(tac "$state")
  rm -f -- "$state"
'
```

Jika lock gagal diperoleh, deploy/anak prosesnya mungkin masih hidup: periksa prosesnya dahulu. Jika suatu unit gagal start, file tetap ada; periksa `systemctl status NAMA_UNIT` dan `journalctl -u NAMA_UNIT` sebelum mengulang recovery. Jangan menghapus file untuk melewati pemeriksaan tanpa memulihkan layanan. Sesuaikan seluruh jalur jika `WAPALA_BASE_DIR` bukan default.

Referensi perilaku stop/start dan aktivasi unit: [systemctl](https://www.freedesktop.org/software/systemd/man/latest/systemctl.html).
