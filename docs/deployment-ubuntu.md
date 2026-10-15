# Native Ubuntu deployment

Target: Ubuntu 22.04 or newer, Node.js 24 LTS, native PostgreSQL, Nginx/TLS, systemd and full ClamAV signatures. No Docker. The source release is a code package; private Src documents, CSV/album imports and organization images/books remain deferred and must be supplied through approved imports later. No production mock seed or automatic imports.

## Prepare the host

Install Node 24 from the official signed distribution, verify its signature/checksum and `node --version`, and ensure the verified binary is `/usr/bin/node` (adjust units to the actual path when needed). Install native `postgresql`, `postgresql-client`, `nginx`, `clamav`, `clamav-daemon`, `clamav-freshclam`, `certbot`, build tools, and the certificate/Nginx plugin if used. Keep OS/security updates enabled. On Ubuntu 22.04 use a supported ClamAV release capable of current signatures; obsolete engine/signature failures block uploads.

Create a non-login `wapala` service user/group, `/srv/wapala/releases`, private `/var/lib/wapala/media`, `/var/lib/wapala/restore-drills`, and `/etc/wapala`. Keep media mode 0700 owned by wapala, secret environment mode 0600 owned by root, and source/release directories owned by the deployment account with service read access. Database is bound to loopback, using a unique non-superuser role with only its application database. Do not expose ports 3000/5432/3310; allow SSH and Nginx 80/443 only. Use a separate staging restore role/database on a staging host where feasible.

Copy `.env.production.example` to `/etc/wapala/production.env` and replace every placeholder privately. Generate SECURITY_KEY using 32 cryptographically random bytes encoded as base64; back it up securely and do not rotate it casually. Use the canonical HTTPS APP_URL. Percent-encode credentials in DATABASE_URL. Configure real SMTP credentials and FROM; port 587 requires STARTTLS, 465 uses TLS. Public forms are protected by same-origin CSRF, HttpOnly form-owner cookies, and persistent throttling; no third-party verification service is used. Sink email and preview mode are rejected in production. Do not put TEST_DATABASE_URL or developer secrets into this environment. systemd EnvironmentFile syntax is not a shell script; do not source untrusted files.

## Antivirus

Run freshclam to provision the full official daily, main and bytecode signature databases, then enable its updater and clamd. Do not substitute a tiny test signature set. Install `deploy/clamdscan-wapala.sh` as `/usr/local/libexec/clamdscan-wapala` root owned, executable. Configure clamd LocalSocket `/run/clamav/clamd.ctl`, socket group `clamav`, mode 0660; the app unit includes that supplementary group. Avoid TCP exposure. Keep database permissions readable by the daemon. Set StreamMaxLength at least 30M for the application upload limit; retain ClamAV archive/document scanning and normal limits. The wrapper streams files so the daemon needs no direct access to private media or systemd's private temporary directory.

The application accepts only scanner exit 0; malware exit 1 is rejected; missing scanner, invalid database, timeout or other exit codes fail closed. `deploy/release-readiness.sh` tests actual clean/EICAR files as wapala. Also test unavailable/stopped scanner against the staging upload flow: it must reject the upload and create no committed media. Never disable scanning to fit 2GB RAM.

## Build and activate

Extract the audited ZIP into a NEW release directory, never on top of the development checkout or the active release. Verify SHA-256 against the release report. Create the empty `public` directory if the package contains no structural assets. Do not copy private legacy asset directories. With the production environment securely provided by the deployment runner, run:

```sh
npm ci
npm run db:generate
npm run typecheck
npm run lint
npm test
npm run test:backend
npm run build
```

Generated Prisma files and dependencies are deliberately absent from source ZIP. Build on CI/a host with sufficient memory; a successful build on another machine is not a 2GB runtime measurement. Retain locked production dependencies plus tsx/Prisma CLI for source email worker/migrations; do not run `npm prune --omit=dev` without replacing these operational commands.

After a verified backup, run `npm run db:migrate` with production environment, not `db:seed`. Migrations change the database; inspect them and use a maintenance window. Copy `.next/static` to `.next/standalone/.next/static`, and `public` to `.next/standalone/public`. Promote the new release by atomically changing `/srv/wapala/current` to it; retain the previous release for code rollback. Database rollback requires its own restore decision, not only swapping the symlink.

Install the supplied app/email units and timer, run `systemctl daemon-reload`, enable/start app and timer. The app binds 127.0.0.1:3000. Bootstrap a Super User with `npm run auth:bootstrap-token` using the approved private terminal flow and finish `/wapala`; do not record tokens/passwords in logs, reports or ZIP. No default password is provisioned.

Install `deploy/wapala-loans-overdue.service` and `.timer` as additional units, but leave the timer disabled and do not start the service during preparation. Confirm `/usr/bin/npm` belongs to the verified Node 24 installation (adjust the template path if necessary), production environment/secrets, migrations, database health and the nonroot service permissions before opting in. Verify the job's Jakarta day-boundary/idempotence integration tests against a separate test database first. The deployed worker updates at most 100 outstanding past-due loans per transaction with matching history/audit; it does not automatically approve loans, return stock or apply penalties.

After those deployment checks pass, the operator creates root-owned `/etc/wapala/loans-overdue.enabled` with mode 0600 and ensures `/etc/wapala` is root-owned and not service-writable. Both units have ConditionPathExists for that explicit gate; installing templates alone does not schedule database writes. Run one approved `systemctl start wapala-loans-overdue.service`, inspect its exit/result and audit records, then `systemctl enable --now wapala-loans-overdue.timer`. It runs five minutes after boot and five minutes after the previous run finishes; systemd does not overlap the same oneshot unit. Larger backlogs drain in bounded batches across subsequent runs. No restart policy creates an immediate retry loop. Monitor failed units and job logs; include this worker in the memory benchmark. On maintenance/rollback/backup, stop the timer AND any active service before attesting writers stopped. To suspend the schedule persistently, disable/stop the timer and remove the gate only after reviewing that exact root-owned target.

Configure the actual domain in `deploy/nginx-wapala.conf`. Provision a valid Let's Encrypt certificate via port 80/ACME, then activate the TLS server block; do not enable references to nonexistent certificates. Nginx overwrites forwarded client headers and serves only the application proxy; no media directory alias is permitted. Verify `nginx -t`, reload, and test HTTPS. Enable certificate auto-renewal and verify its dry run. TRUST_PROXY=true is appropriate only with the bound loopback app and this trusted proxy.

## Release gates on the actual VPS

Run readiness as root with APP_URL set; the script reads services and health endpoints, uses temporary scanner fixtures, and performs no database writes. Run `bash deploy/release-memory-check.sh 300` during representative staging load, including authenticated screens, galleries, event forms, permitted uploads, full-signature scanner activity and outbox worker delivery. Preserve output, latency/error measurements and any service/OOM logs. The sampler requires >=200MiB available and no new host OOM kills; this is a minimum gate, not a claim of capacity. Full ClamAV plus PostgreSQL plus Next on a 2GB VPS can exceed safe memory. If it fails, improve measured resource use or increase capacity; do not remove scanning. Swap can cushion spikes but does not prove acceptable throughput. PostgreSQL service may be a meta-unit: also inspect the actual cluster process/service and all RSS.

Confirm real SMTP delivery/recovery, scanner fail-closed behavior, public/private media authorization, backend integration against a separate `_test` database, fresh installation/bootstrap, and staging restore drill. Local unit tests cannot verify TLS, SMTP, Linux permissions, native ClamAV or VPS memory. Production acceptance remains blocked until these gates have evidence.

## Backup and restore drills

Load connection environment through the trusted runner without echoing secrets. Stop app, email timer/worker, loans-overdue timer/worker, event cleanup and any other writer; verify they stopped. Set WAPALA_WRITERS_STOPPED=yes only after verification, then `node scripts/release-backup.mjs backup /ABSOLUTE/NEW/BACKUP-DIRECTORY`. The script creates a new private directory, custom-format pg_dump, media tar and SHA-256 manifest; refuses media symlinks/special files and existing directories. Restart previously enabled writers after completion. Encrypt backups, copy off-host, rotate and monitor failures; keep SECURITY_KEY in the separate approved secrets store.

For a drill, use an authenticated trusted backup and a distinct loopback RESTORE_DATABASE_URL with a new name ending `_restore_test`, then `node scripts/release-backup.mjs restore-stage /ABSOLUTE/BACKUP-DIRECTORY`. It checks checksums/archive paths/types, refuses existing databases, creates new media under `/var/lib/wapala/restore-drills`, restores without original owners/ACL, and checks table availability. It NEVER replaces production DB/media. The staging role needs CREATEDB for this drill (never grant that privilege to the application role). Independently compare expected record counts, inspect media hashes/authorization and exercise the app against this staging copy. The script's count query alone is not a complete recovery test. Delete staging resources only after explicit target review. Production restore remains a separate reviewed maintenance operation.

## Source release packaging

After full QA, `node scripts/release-package.mjs list` shows the explicit allowlist. `node scripts/release-package.mjs create /ABSOLUTE/NEW/wapala-source.zip` refuses overwrite and emits entries, byte count and SHA-256. `node scripts/release-package.mjs audit /ABSOLUTE/wapala-source.zip` audits stored bytes/CRC, paths, duplicates and allowlist. Never put imports/private documents in the source release. Source contents are copied exactly, not rewritten. Inline source/test fixtures still require the final review; filename exclusions are not a general secret scanner. Verify the extracted package with npm ci, Prisma generation, tests/lint/typecheck/build in an isolated NEW directory before delivery.
