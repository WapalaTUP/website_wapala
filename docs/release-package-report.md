# Source release preparation report

Prepared 14 October 2026. Scope is packaging/deployment tooling; no VPS changes, database writes, credentials inspection, browser actions, import execution or production rollout were performed. CodeGraph CLI status reported a current Dev_Website index; targeted exploration traced native scanner and media storage before tooling was written.

## Included source contract

The deterministic store-method ZIP copies reviewed source bytes exactly. It uses a sorted allowlist for src/tests code, schema/migration/seed source, explicit operational scripts, deploy templates, selected safe root build/config files, environment examples, this report and Ubuntu guide. Prisma generated output is regenerated after extraction. The PDF worker is library code, not a private book. Only named neutral placeholder/empty-state SVG assets are eligible; organization raster images, books, albums and all other public assets are excluded. `.env.example` and `.env.production.example` contain placeholders, not credentials.

Excluded: private parent Src, CSV/XLSX import payloads, node_modules, generated Prisma, Next build output, output/import/private/credential trees, `.local`, secret `.env` files, CodeGraph index, personal docs/operational ledgers/maps, organization images/books/albums, old sync/import/previews, and `src/lib/live-albums.ts`. Runtime imports of that album dataset fail packaging. The runtime source import has now been removed, and list auditing passes. Existing development source is not silently transformed during packaging. Any source/test data retained inline still requires explicit final privacy review; path allowlisting is not a complete secret detector.

ZIP audit rejects traversal/absolute/backslash paths, forbidden entries, case-insensitive duplicates, mismatched local/central names and sizes, encryption/extra attributes, unlisted bytes, CRC mismatches and unsupported ZIP layout. It audits persisted bytes after creation. Exclusive create refuses an existing destination, preventing stale-package overwrite. Extraction is into a NEW isolated directory; application assets/source are never overwritten.

## Evidence

Tests were added first: missing packager failed, then selection/determinism/audit/exclusive-create fixtures passed. A further runtime-import fixture failed before adding that fail-closed check, then passed. Staging DB guard test failed before its implementation, then passed. A real Windows directory junction fixture proves links are rejected rather than copied.

Latest targeted run: `npx tsx --test tests/release-package.test.ts tests/release-backup.test.ts`: 5 passed, 0 failed. Targeted eslint passed on both modules and tests. Node module `node --check` and Git Bash `bash -n` for deployment scripts passed. These are syntax checks, not Linux execution evidence. Final parent QA must repeat these after integration.

After runtime cleanup, broad `npm test`: 87 passed, 0 failed. `npm run test:backend`: 35 passed, 0 failed. The earlier in-progress phone-tracking UI failure now passes after the source owner's integration. Typecheck during integration still reported the source owner's two legacy component nullable-state errors (`admin.tsx` and `import-dialog.tsx`); those are reported for final integration resolution. These observations are not the final global QA result.

Runtime defaults are now empty server-backed state; browser storage cannot populate records or authorize mutations. Legacy update/reset throw before executing their mutation callback, and previewMode always returns false even under development/test preview environment. The synthetic former seed lives only in `tests/fixtures/seed.ts`; campaign render tests inject it explicitly with DataProvider. Gallery ordering/archive/highlight tests now supply synthetic record fixtures, not real organization album rows. Static book/album/generation catalogs are typed empty and default photos reference a neutral authored SVG. These boundaries have new behavior tests; remaining source owner asset/UI wiring is outside this packaging scope.

## Deployment and recovery gates

Native Ubuntu guide/templates cover Node 24, nonroot standalone Next/systemd, native PostgreSQL, SMTP outbox timer, Nginx HTTPS and trusted forwarding, private media, full official ClamAV signatures via streamed daemon scanning, and absence of default production mocks/imports. Sample resource limits are guardrails and need host measurements.

The existing `npm run loans:overdue` is wired into nonroot `wapala-loans-overdue.service` and a five-minute timer. Both require a root-controlled `/etc/wapala/loans-overdue.enabled` gate; documentation keeps them disabled until production configuration, migrations, permissions and isolated job integration tests pass. No host units/gates were installed or started in this task. The worker source is explicitly allowlisted so the extracted package retains the npm command's target. Backups must stop both timer and active worker.

Backup utility requires verified writers stopped, creates a new private destination, dumps DB plus media and checksums, streams hashing, and refuses media links/special files. Staging restoration permits only a distinct local new `_restore_test` database and new `/var/lib/wapala/restore-drills` media location; refuses existing DB reuse and never replaces production resources. Checksums and table count are necessary but insufficient recovery evidence: compare data/media and application behavior independently. Backup manifests provide integrity, not authenticity; only use trusted encrypted backups.

The host readiness script performs actual health/TLS and native EICAR/clean scanning. Memory sampler checks no new OOM kills and >=200MiB reserve while operator-generated representative staging traffic exercises app/Postgres/full scanner/outbox. SMTP delivery, TLS renewal, Linux permissions, restored integrity and realistic 2GB latency/concurrency remain UNVERIFIED SERVER GATES. Full-signature ClamAV memory may exceed safe 2GB capacity; upload scanning must remain enabled and fail closed.

## Release artifact status

No production source ZIP has been created yet. Temporary fixture ZIPs were created only inside test temp directories and removed afterward. Final ZIP, SHA-256, entry list and isolated extraction npm ci/generate/test/lint/typecheck/build results must be attached only after the source owner completes integration QA. This report does not claim production readiness or deployment success.
