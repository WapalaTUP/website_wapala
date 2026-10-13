# SDD ledger — plan: docs/superpowers/plans/2026-10-13-admin-revisions.md

Execution: Native, user approved. Spec approved. Five task checklist: campaign domain; campaign UI; imports; management/accounts/Oprec; verification.
Pre-flight: tasks 1→2 share Campaign/Donation/store; tasks 1→4 share hydration; tasks 3→4 share records/store. Contracts compatible; preserve legacy hydration before exposing new UI.
Ruling: no Git repository exists; work in the explicitly requested Dev_Website checkout and retain this ledger instead of Git-only scratch/commit helpers — plan prohibits initializing Git — cost: no commit-level rollback evidence.
Task 1: started; baseline suite previously 20/20. No application edits yet.
Task 1: complete — four new tests RED→GREEN, full suite 24/24, typecheck clean. Task 2: started; reuse tested active/closed predicate.
Tasks 2/3: campaign and import UI implemented; new import domain tests RED→GREEN, suite 29/29, typecheck clean; browser checks pending final pass. Atomic persistence retains prior state on quota failure.
Task 4: started. Ruling: reset-password actions only record preview reset requests; no real credentials are stored or changed — binding approved frontend-only spec — cost: backend still required for functional reset.
Task 4: complete — management/account tests RED→GREEN, all LoanStatus obligations preserved, OR and inventory untouched. Suite 33/33, typecheck/lint/build clean. Tasks 2/3 integration checks clean; final browser/review gate remains.
Task 5: in progress. CodeGraph sync confirms CampaignAdmin, ImportDialog and ManagementReset present. Reviewer package: plan/spec plus changed/new files (no Git SHA available).
Final: Ruling: QRIS-only misleading unavailable-method notice regraded Important — contradicts a usable configured payment method — cost if wrong: removing an unnecessary notice; regression reproduced by SSR rendering.
Final: minor (deferred): mapping change retains prior general error text; confirmation and validation still refresh. Clear-message polish remains, not a data-loss issue.
Final: Ruling: production authentication/payment and deployment checks are outside this approved frontend preview; backend must implement them — cost: not production-ready. Browser visual behavior is verified separately by primary agent.
Final: fixed multi-section identifier zero loss and QRIS-only notice — targeted tests RED→GREEN; final suite run pending.
User amendment: multiple bank/rekening entries with recipient names and separate donation poster upload. Apply as extension of the campaign task during continuous execution; preserve legacy bank data and do not invent recipient names. Added domain/migration tests before implementation.
User constraint: no further browser operation. Final visual review is by user screenshots; no browser cleanup/navigation performed after this instruction. Cost: latest bank/poster layout has automated SSR coverage, not a new browser visual pass.
User amendment implemented: bank rows add/remove, recipient required on save, separate poster upload/uncropped public display, bank selection and snapshot on confirmation. Domain/migration tests green; SSR regression reproduced RED then GREEN. TypeScript test narrowing corrected before final full checks.
Final verification: npm test 38/38 passed, npm run typecheck exit 0, npm run lint exit 0, npm run build exit 0. Tasks 1–5 complete for frontend preview. Browser halted per user; visual acceptance remains user screenshot review. CodeGraph map and backend handoff updated. No production credentials, payments, deployment or private-source import performed.
