# Review package — Backend 2A

Read-only review, no Git repository/range available. Root: Dev_Website. User approved inline implementation and one final fresh review. No subagent fanout, no file edits, no browser, no real SMTP, no VPS operations.

Spec: docs/superpowers/specs/2026-10-13-backend-design.md
Plan: docs/superpowers/plans/2026-10-13-backend-foundation.md
Ledger: docs/backend-foundation-ledger.md (all Ruling lines).

Implemented: src/server/**, prisma/**, src/proxy.ts, src/app/api/**, src/app/wapala/**, src/app/admin/{foundation,[[...module]]}/page.tsx, src/components/auth/**, scripts/{backend-dev,backend-integration,bootstrap-token,recover-superuser,terminal-password,email-worker,local-postgres}.ts; .env.example/config/package changes. Tests: tests/backend/** and tests/auth-ui.test.ts. Docs: backend-local-setup.md. Inspect source directly; generated/.local/Src/private files excluded and must not be read.

Review focus verbatim:
1. Dua bootstrap/reset serentak: satu menang, satu gagal tanpa akun/token duplikat (Tasks 2, 4, 5).
2. SMTP timeout setelah pesan diterima: retry tidak membuka token ganda atau mengirim pesan tanpa batas; token sensitif tidak tersimpan plaintext (Task 5).
3. Header proxy/IP palsu: throttle tidak bisa dilewati dengan X-Forwarded-For pengguna; trusted proxy eksplisit (Task 3).
4. Client role palsu dan sesi must-change: tidak bisa membaca domain admin atau membuka endpoint pengguna (Tasks 4, 6, 7).
5. Salah database/env: runner integration tidak menghapus database produksi dan build tidak membutuhkan koneksi DB atau SMTP (Tasks 1, 8).

Recorded evidence: frontend39, backendunit14, real PostgreSQL/HTTP integration25 passed; lint/typecheck/build passed; runtime npm audit zero, dev lint braces advisory unpatched. No browser visual QA (user forbids). Full operational APIs/importer/production packaging are subsequent 2B/2C, not claims of current foundation. No actual production deployment, native VPS setup or real SMTP delivery tested.

Judge actual security/functional impact even if spec omits a case. Output specific file:line, evidence, severity Critical/Important/Minor, recommendations and assessment. Explicitly list every Declined to judge item. Do not mark source text assertions as behavioral proof. Test runs are allowed with provided scripts but do not create actual user credentials, send email, navigate browser or mutate source. Do not spawn other reviewers.
