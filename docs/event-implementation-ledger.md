# Event ledger — plan: docs/superpowers/plans/2026-10-13-event-form-builder.md

User approved specification and plan; execution native in existing local workspace, 13 October 2026. Tasks 1–7 pending. No browser use.

Task 1: initial optional/required/condition/type/rekey tests RED before implementation → GREEN; full frontend suite 69/69 before final whitespace regression (RED observed, fix applied). Full final rerun required.
Tasks 2/3: additive migration 8, immutable revision snapshots, active/draft separation, session/RBAC freshness, quota locking, replay payload/owner and anonymous private media implemented. PostgreSQL suite 63/63 before latest HTTP/cleanup additions; final rerun required. Native scanner availability is NOT claimed by fake scanner protocol tests.
Tasks 4/5/6: editor tabs, custom fields, condition/sections, safe semantic rekey, public event cards/signup, pagination/private responses and ExcelJS roundtrip implemented. Editor SSR and public card RED→GREEN. Cross-section renderer regression RED→GREEN. Text search JSON scalar mismatch reproduced in PostgreSQL; switched to bounded parameterized JSON-text matching. Typecheck and lint passed before last additions.
Task 7: pending full fresh verification and independent review. Local migration8 applied successfully and verified WAPALA devprocess restarted for Prisma refresh; user accounts preserved. Development localhost3000 running.

Checkpoint before independent review: frontend 70/70, backend unit 23/23, real isolated PostgreSQL/HTTP 64/64, typecheck and lint passed. Build completed with the pre-existing scanner broad-filesystem tracing warning; no scanner bypass. HTTP Event test covers publish→token→registration→replay→private responses→Excel→admin page. Pending upload cleanup RED→GREEN and excludes bound files. Required whitespace RED→GREEN. Cross-section condition SSR RED→GREEN.

Task 1: complete, verified shared validations and semantic rekey.
Task 2: complete, verified additive local migration and isolated revision/permission tests.
Task 3: complete, verified anonymous token/uploads, malware failure, scoped owner binding, quota/replay and cleanup.
Task 4: complete, editor and actual authenticated admin endpoint/page tested.
Task 5: complete, Event navigation/cards/form/section routing implemented, HTTP registration verified. Visual browser QA intentionally prohibited; user screenshot checkpoint required.
Task 6: complete, Excel reopen and authenticated export verified. Task 7 awaiting final independent review and any regression fix pass.

Independent review: first Astra reviewer could not start due service usage limit. Available fallback gpt-6.1-sol reviewed read-only using current CodeGraph and returned 7 Important, 2 Minor; no Critical. Fix pass is underway; not re-dispatching another review.

Important fixes (RED observed): export budget before allocation and distinct revision/batched data; expired uncertain submission reconciliation with late-commit fencing; refreshed upload IDs removed with re-upload instruction; disabling all editor mutations during save; effective scale endpoint validation; accessible names on public controls; Excel column cap. Regression commands and final counts recorded at final checkpoint.

Additional Excel format regression in same fix pass: allowed long checkbox labels exceeded 32,767 characters in a cell (RED). Answers now continue into labelled additional columns, and long dictionary definitions continue over labelled parts without truncating data (GREEN). Display-text byte/cell limits are checked before workbook allocation. Roundtrip checks concatenate continuation cells to the complete original answer. Backend unit suite now25/25.

Final: fixed all 7 Important findings — RED→GREEN tests: preflight export budgets, refreshed upload recovery policy, replay reconciliation/fence late-commit denial, editor fieldset locking, effective scale defaults, accessible controls, Excel column budget. PostgreSQL65/65 after replay fence; final complete rerun in progress following last XLSX cell regression. No second review dispatch.

Ruling: add replay fence table in additive migration9 and signed, read-only receipt reconciliation with cancellation fence — token expiry after an uncertain network result must not enable a second registration, and locking only without a fence would race a late original request — costs one small hash-only metadata table and recovery endpoint.
Ruling: refresh retains compatible text/choices but explicitly clears upload references and asks participants to select files again — upload ownership remains bound to original token/revision, not silently transferable to a new public capability — costs re-upload after refresh.
Ruling: export additionally caps 200,000 cells and 16,384 columns before ExcelJS allocations, with SQL byte preflight and batched responses/unique revision parsing — protects a 2GB server and Excel format constraints; no partial export — costs narrowing filters on very wide/large historical data.

Final review: minor (deferred): reorder-only choices still renew semantic IDs; participants refreshing must re-enter affected answers. No existing committed response is lost.
Final review: minor (deferred): search cap counts whole-event hits before date/revision narrowing; use a more specific keyword if event search exceeds 10,000 matches.
Final: Ruling: review declined visual appearance/native ClamAV/deployment/proxy/physical2GB measurements and separate LoanForm/gallery diagnosis — visual QA stays screenshot-based, native scanner/deployment are unverified prerequisites, and diagnostics are reported without claiming a fix — costs remaining user/environment checks; no production-ready claim.

FINAL HANDOFF CHECKPOINT: frontend73/73 (`.local/event-complete-ui.log`), backend unit25/25 (`.local/event-complete-unit.log`), isolated real PostgreSQL/HTTP65/65 (`.local/event-complete-db.log`): 163/163. Typecheck/lint exit0 (`event-complete-tc.log`, `event-complete-lint.log`), final build exit0 (`event-complete-build.log`) with pre-existing scanner filesystem tracing warning. Review Important fixes verified with new RED→GREEN regressions and green full suites. No second reviewer. Task7 complete for local feature checkpoint, not deployment/native scanner or screenshot visual approval.

Local migrations8/9 applied additively, latest Prisma client generated, verified Dev_Website process restarted; server3000 ready and `/api/health` plus `/event` HTTP200. Passwords/user sessions/data preserved. User-requested Super User login-attempt unlock did not replace credentials.

Fresh CodeGraph incremental sync:18 changed files after final review fixes; project scoped to Dev_Website. Keep workspace and Git master unchanged/uncommitted; no PR, push, ZIP or VPS action. Durable ledger retained per ruling. Supplemental user checks recorded in `docs/public-module-diagnostics.md`: public LoanForm still reads legacy preview equipment and gallery native scanner unavailable; those were diagnosed, not falsely declared fixed.

Support request: Super User failed-login count 3 and lock were cleared explicitly at user's request, with operator audit. Password/account active state/session credentials untouched. No global throttle reset.

Ruling: parent Git directory now exists on master but all application files are untracked — no commits/staging of private Src/output or unrelated files; retain ledger rather than invent a Git review range — costs review-by-file instead of commit diff.
Ruling: meaning-changing choice/type/grid edits are canonicalized server-side on draft save, not during each keystroke — avoids losing editor focus and preserves condition links — changed question IDs are intentionally new while old revisions remain intact.

Pre-flight: shared form contract (1→2/3/4/5/6), revision DTO (2→3/4/6), token/media ownership (3→5), historical answer mapping (2/3→6) must remain identical. No interface conflict found.

Ruling: work in the existing user-tested checkout with explicit execution approval rather than move the live devserver to a different checkout — preserves user's local sessions and testing URL — costs isolation from unrelated edits, so only Event-related files are edited and existing changes preserved.

Ruling: keep durable documentation/ledger instead of deleting execution evidence after completion — existing project release audit needs this and no agent-created commits are requested — costs a small documentation file.
