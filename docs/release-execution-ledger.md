# Release execution — 2026-10-14

Binding scope: user's explicit instruction to finish code through audited ZIP, defer Src/CSV/albums import. No browser. No user data/account resets. Existing local checkout changes preserved; no automatic Git staging/commit/push. Deployment actual VPS remains after ZIP. No production-readiness claim based solely on unit tests.

Execution: public integration by primary; independent inventory actions and operational export/books/deployment packaging assigned focused workers. Independent files owned explicitly. Final whole-product review and one consolidated QC/QA run after integration. No repeated approval/checkpoint stops; external account creation, credential disclosure, destructive data operations still forbidden.

1. Runtime source audit: complete. Active public, portal, and admin routes read server data; login and public wording no longer expose a preview branch. Browser storage is theme-only and cannot become data authority.
2. Public services/routes/forms: complete. Loan/OR/donation/tracking and Event use canonical Origin/CSRF, persistent throttling, scoped private media, replay-safe writes, and code-plus-phone lookup/capabilities. Cloudflare Turnstile was removed entirely by explicit instruction (no widget, token, or Siteverify on any path).
3. Inventory availability actions: complete. Versioned availability-only PATCH keeps stock and other fields intact; the UI provides Edit, availability toggle, and Archive.
4. Exports/books/settings/archive/notifications: complete. Bounded exports, controlled book delivery, archival restoration, overdue-job timer templates, and recovery/outbox flows are included.
5. QC/QA: complete in the local release environment. Frontend/unit 88/88; backend unit 38/38; PostgreSQL/HTTP/native scanner 79/79; typecheck, lint, production build without warnings, and runtime dependency audit pass. Browser UAT and real VPS/SMTP/TLS checks remain operator release gates, not claimed as local evidence.
6. Deployment/backup/readiness: complete as source/runbook. Ubuntu native nonroot systemd, Nginx, PostgreSQL, ClamAV fail-closed scanning, backup/restore safety, and a 2 GB memory preflight are packaged. They require execution on the VPS after configuration.
7. ZIP: creating final source package now. It is exact-copy audited, excludes organization assets/data/secrets/local runtime/node_modules/build, and will be reconstructed in a clean directory before handoff.

Ruling: imports and collection are explicitly deferred by newest instruction; existing admin member/inventory import functionality stays, but no source data extraction included now — cost: first deployment database empty until admin imports it.
