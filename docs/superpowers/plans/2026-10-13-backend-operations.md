# Backend operations and integration implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace preview-only operational data with validated, transactional PostgreSQL services and integrate the accepted UI.

**Architecture:** Route handlers use the existing database session/CSRF boundary. Domain services recheck the principal inside every material transaction, lock mutable resources, and append audit records. Public DTOs expose no applicants, donors, members or collateral. Media is stored outside the public directory and addressed by validated IDs.

**Tech stack:** Existing Next.js, Prisma/PostgreSQL, Zod, Argon2id and Node filesystem.

**Spec:** docs/superpowers/specs/2026-10-13-backend-design.md

## Global constraints

- Ubuntu 22+ native production, no Docker, RAM 2 GB; no actual VPS access.
- No browser operation; test with Node, real isolated PostgreSQL and HTTP.
- Source ZIP contains no organization data, credentials, uploads or dependency/build output; private import bundle is separate.
- No preview/localStorage state accepted as production authority; account identity and audit actor come from the database session.
- One annual OR period per year, one active period; management rollover must not change OR or release active loan reservations.
- Several campaigns, bank account numbers are strings with holder names; independent cover/poster/QRIS.
- Public rich content is encoded text, never arbitrary HTML or executable URLs.

## Review focus

1. Concurrent loan approvals must never reserve more usable equipment than exists, including partially overlapping dates.
2. Closed campaigns cannot accept new confirmations; bank edits must not change past confirmation snapshots or double-count verification.
3. Rollover and password reset must commit together or neither; active obligations and recruitment history must survive.
4. Imported identifiers retain leading zeros; duplicates/conflicts reject the entire batch without silently overwriting edits.
5. A revoked session or client-supplied role cannot write through a domain service even when resolved before a concurrent password reset.

## Task 1: Campaigns and donation transactions

**Files:** prisma/schema.prisma; new migration; src/server/domains/campaigns.ts; tests/backend/integration/campaigns.test.ts; src/app/api/admin/campaigns/**.

**Interfaces:** consume Principal, RequestContext, assertFresh(tx, principal, permission), writeAudit(tx,event). Produce saveCampaign(principal,input,ctx), listCampaigns(principal), publicCampaigns(), submitDonation(input,ctx), reviewDonation(principal,id,status,note,ctx). Return DTOs with string bank numbers, explicit fields, version for optimistic updates.

- [ ] Write tests using real PostgreSQL for two campaigns, multiple accounts retaining `00123`, duplicate-account rejection, bank snapshot persistence, closed campaign rejection, simultaneous idempotent verification, stale update conflict and revoked-principal denial. Assert literal amounts, not the total helper's result.
- [ ] Run `npm run test:backend:integration`; expect missing campaign module/observable assertion failure.
- [ ] Add Campaign, CampaignBankAccount and Donation models. Use FK restrictions, positive money/check constraints and campaign/account locks. Save accepts strict validated payload and version. Donation verification locks donation and accepts only waiting→verified/rejected; repeat same decision does not duplicate audit/total. Bank snapshots store bank/number/holder on confirmation.
- [ ] Implement route handlers with `authenticated(request,"campaigns:write")`, `readJson`, `route` and service calls. Public submission additionally uses preauth Origin/CSRF and rate limit; no donor public read endpoint.
- [ ] Run integration suite/typecheck and record results in ledger; no Git commit possible in this checkout.

## Task 2: Annual recruitment and members

**Files:** prisma/schema.prisma; new migration; src/server/domains/recruitment.ts; src/server/domains/records.ts; tests/backend/integration/recruitment.test.ts; records.test.ts; api/admin/recruitment/**; api/admin/records/**.

**Interfaces:** produce setRecruitmentPeriod(principal,year,active,ctx), submitApplicant(input,ctx), listApplicants(principal,year), saveRecord(principal,module,input,ctx), importRecords(principal,module,rows,ctx). Structured fields are bounded strings with a strict module-specific allowlist; no arbitrary HTML, role or credential fields.

- [ ] Write real DB tests for one period/year, concurrent activation, all-admin read/MM-only write, zero-preserving member number, duplicate batch rollback and no public member disclosure.
- [ ] Run integration suite; expect missing services.
- [ ] Implement yearly unique period and PostgreSQL partial unique active index. Generate nonsequential public codes cryptographically. Use bounded validation and phone digest for future gated revisions, never public raw private records. Lock active-period change with transaction advisory lock. Member imports validate entire input before transaction, reject conflicts rather than overwrite.
- [ ] Run integration/typecheck and ledger results.

## Task 3: Inventory, loans and rollover

**Files:** prisma/schema.prisma; migrations; src/server/domains/inventory.ts; loans.ts; management.ts; tests/backend/integration/{loans,management}.test.ts; API counterparts.

**Interfaces:** produce saveEquipment(principal,input,ctx), requestLoan(input,ctx), transitionLoan(principal,id,input,ctx), rollover(principal,input,ctx). Equipment locks are sorted by UUID; all overlapping approved/in-use reservations count against fit quantity. Database statuses are an enum, no whole client record updates.

- [ ] Write tests for oversubscribed concurrent approvals, returned stock release, active reservations surviving rollover, OR unchanged and reset choices preserving/resetting selected admins.
- [ ] Run isolated DB tests; expect missing services.
- [ ] Implement strict dates, quantities, state machine, ordered locks, immutable history and audit atomically. Rollover SU-only uses common account administration lock and transactional revocation/reset, never generates default passwords.
- [ ] Run integration/typecheck and record evidence.

## Task 4: Controlled media and content

**Files:** src/server/media/**; domains/content.ts; API media/content; tests/backend/{media.unit,content.integration}.test.ts.

**Interfaces:** Media IDs map to filesystem paths generated server-side, never input filenames. Content DTO uses public approved media only; album date unknown is null, not upload/import date. Upload returns media ID and safe display URL after signature/re-encoding, byte/pixel bounds and malware scanner success; failures stay quarantined.

- [ ] Write path traversal, wrong signature, oversize, private-access and encoded-content tests; run RED.
- [ ] Implement quarantine→validation→registered storage, no public raw upload path. Keep books private and bounded page endpoint. Store gallery albums/categories/dates/descriptions independently of photos.
- [ ] Run tests/typecheck and ledger evidence.

## Task 5: UI transport integration and end-to-end verification

**Files:** src/components/auth/**; operational admin/forms/public views; src/lib/store.ts; server pages; tests/backend/integration/operations-http.test.ts and frontend tests.

**Interfaces:** Server session passes only DTO identity; client module requests separate authorized domain APIs. Public state contains public records/media/campaign totals and flags only. API mutations await response and show validation errors; no optimistic success before transaction. Legacy demo is restricted to explicit non-production preview.

- [ ] Add HTTP and SSR regressions for actual module routes, no demo seed in backend public UI, multi-bank campaign edits and annual OR controls. Run RED.
- [ ] Integrate accepted components with specific service endpoints; no arbitrary full-state PATCH bridge. Remove role switch in backend; real logout/reset handlers retain CSRF.
- [ ] Run frontend/backend/integration/typecheck/lint/build, audit runtime dependencies. Fresh review after all operational work; no production-readiness claim before its fixes.
