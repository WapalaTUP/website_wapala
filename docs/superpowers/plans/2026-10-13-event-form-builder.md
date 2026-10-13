# Event Form Builder Implementation Plan

Execution approved by user. Tasks1–7 implemented and locally verified: 163/163 tests, typecheck/lint/build passed. Final independent review and RED→GREEN fixes recorded in `docs/event-implementation-ledger.md`; two Minor findings remain noted. Original step checkboxes below remain the design checklist; rely on the dated ledger for execution evidence. Additive migration9 was needed for safe expired-token replay reconciliation. Native scanner and screenshot visual approval remain operational/user prerequisites. No Git commit/push, browser or VPS deployment performed.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. Execution method: native, in this session. No implementation subagents.

**Goal:** Admin WAPALA dapat membuat event dan formulir dinamis, menerima pendaftaran publik dengan aman, dan mengekspor seluruh jawaban ke Excel.

**Architecture:** Shared typed form definitions and answer validation feed one renderer/editor. PostgreSQL stores editable drafts, immutable published revisions and registrations. Server authorizes administration, locks event acceptance, preserves historical answers and generates exports.

**Tech Stack:** Existing Next.js 16.4, React 19, TypeScript, Zod 4, Prisma 7/PostgreSQL, ExcelJS 4, Sharp and fail-closed ClamAV media pipeline. No new product dependencies.

**Spec:** `docs/superpowers/specs/2026-10-13-event-form-builder-design.md` (approved by user 13 October 2026).

## Global Constraints

- All participant questions default optional; event identity title is required. No hardcoded requirement for name/NIM/WhatsApp.
- Super User and MULTIMEDIA administer events; server permissions required. Do not grant POH/INVENTARIS participant access automatically.
- Limits: 200 questions, 200 options/question, 10,000 text characters, JSON body 1 MiB, JPG/PNG/WebP/PDF files 5 MB and one file/upload question.
- Existing passwords, sessions, accounts and organization records must not be reset.
- Immutable published revisions; unknown question/option IDs rejected. Meaning-changing edits allocate new IDs.
- No browser/CUA. User screenshots are the visual review path; HTTP/SSR tests are not visual proof.
- No payment/check-in/certificates/Google account integration. No source/private documents seeded or indexed.
- No Git repository available. Save checkpoints in operations ledger instead of attempting commits/worktrees.

## Review Focus

1. All-optional form with empty answers must accept one registration, not reject missing personal identity (tasks 1, 3).
2. Two equal question labels or changed option labels must not collapse Excel columns or rewrite past answers (tasks 2, 6).
3. Last quota slot under parallel requests must accept once, with replay of same key not consuming another slot (task 3).
4. Hidden required questions and answers left over after toggling a branch must not become validation failures or leak hidden values (tasks 1, 5).
5. Successful server save followed by failed UI refresh must not invite duplicate registration or publication (tasks 4, 5).

## File boundaries and contracts

New shared module `src/lib/event-form.ts` owns `eventFormSchema`, `EventForm`, `EventQuestion`, `EventAnswers`, `validateEventAnswers(form, answers)` and `visibleEventItems(form, answers)`.

Definition: `{ title:string, description:string, items:EventQuestion[] }`. Question: stable UUID `id`, `kind`, `title`, `help`, `required`, optional UUID `options`, UUID `gridRows`, `validation`, and `showWhen:{questionId,optionId}`. Section items use kind `section` and never accept answers. Option/grid-row labels are presentation text, IDs are identity. Numeric configuration includes min/max; skala has integer endpoints. Answers are record keyed by question UUID, values string/number/string[]/grid answer record. Upload answer is media UUID, not an external URL.

New server modules: `src/server/domains/events.ts` CRUD/public DTOs, `event-registrations.ts` submit/query, `event-export.ts` Excel, `src/server/security/event-form-token.ts` anonymous signed capability and `src/server/media/event-upload.ts` anonymous file ownership/binding. Keep each responsibility focused.

UI: `src/components/events/form-renderer.tsx`, `question-editor.tsx`, `event-editor.tsx`, `event-responses.tsx`, `event-pages.tsx`, plus backend entry `src/components/backend/events.tsx`. Scoped styles in `src/app/event.css`, imported by existing global style entry after confirming current layout imports.

## Task 1: Form contract, conditions and validation

**Files:** create `src/lib/event-form.ts`, `tests/event-form.test.ts`, `tests/event-fixtures.ts`.

**Interfaces:** `validateEventAnswers(form:EventForm, answers:unknown):{answers:EventAnswers, issues:Array<{questionId:string,message:string}>}`. Normalize only supported values; omit hidden/empty optional answers. `visibleEventItems` returns ordered items; reject malformed/cyclic/forward conditions during schema validation.

- [ ] Write fixture factory in tests only, using `randomUUID()` for question/option IDs. Write failing assertions covering empty all-optional forms and required visible fields:

```ts
const form = eventFormSchema.parse({ title: "Camp Fire", description: "", items: [] });
assert.deepEqual(validateEventAnswers(form, {}).issues, []);
assert.equal(eventFormSchema.safeParse({ ...form, items: Array(201).fill(questionFixture()) }).success, false);
```

- [ ] Run `node --import tsx --test tests/event-form.test.ts`; assert missing module/behavior failure before production implementation.
- [ ] Implement strict Zod discriminated question kinds: shortText, paragraph, number, email, date, time, radio, checkbox, select, upload, scale, radioGrid, checkboxGrid, section. Options/grid rows use UUID identities and bounded labels. Validate duplicate IDs, unknown answers, finite numeric values, ISO date/time, configured ranges/selection counts, Other values and grid cell semantics. Reject regex/HTML configuration. Add per-case tests for each type and limits.
- [ ] Add branch tests: prior radio selection shows required NIM, changing selection hides NIM and drops previously entered answer. Test arbitrary/forward/cyclic references rejected. Run targeted tests, then `npm test`. Update ledger with RED/GREEN evidence.

## Task 2: PostgreSQL event storage and immutable publication

**Files:** modify `prisma/schema.prisma`, create next sequential migration after `202610130007_member_unknown_nim`; create `src/server/domains/events.ts`, `tests/backend/integration/events.test.ts`. Modify `src/server/auth/policy.ts`, integration `helpers.ts` cleanup table list.

**Interfaces:** `saveEvent(principal,input,ctx):Promise<EventAdminDto>`, `publishEvent(principal,{id,version},ctx):Promise<EventAdminDto>`, `listEvents(principal):Promise<EventAdminDto[]>`, `publicEvents():Promise<EventPublicDto[]>`, `publicEvent(id):Promise<EventPublicDto>`. Draft form stored as validated JSON, revision form immutable.

- [ ] Write integration test using existing bootstrap/login helpers and isolated test database; service import initially optional so assertion explains missing service. Add permission test expecting deny for POH, plus saved-draft-not-public assertion.

```ts
const m = await import("../../../src/server/domains/events").catch(() => null);
assert.ok(m, "Event service exists");
const draft = await m.saveEvent(principal, eventFixture(), ctx);
assert.equal((await m.publicEvents()).length, 0);
const live = await m.publishEvent(principal, {id:draft.id,version:draft.version}, ctx);
assert.ok(live.publishedRevisionId);
```

- [ ] Run isolated integration suite to observe RED, never using actual user database for cleanup. Add Event, EventFormRevision, EventRegistration relations with restrictive deletes, unique `(eventId, revisionNumber)` and `(eventId, idempotencyKey)`. Event registration references immutable revision. Add draft metadata and draft form, published metadata/form snapshot, optimistic version, status draft/active/closed/archived, optional times/location/quota. Published DTO uses published snapshot only, not unreviewed draft changes.
- [ ] Add `events:write` permission to SUPER_USER/MULTIMEDIA and use requirePermission plus assertFresh inside each mutation transaction. Check media references as public event-poster/event-cover purposes. Publish validates form/metadata and stores immutable snapshot atomically; title/description edits stay in draft until publish.
- [ ] Test stale version rejects without audit side effects, republish creates separate revision and prior form remains unchanged, active without published form cannot accept, closed details readable while draft/archive absent. Generate Prisma client, run migration on isolated DB and integration tests. Apply additive migration to local dev only after suite green, preserving account/session state. Record checkpoint.

## Task 3: Public submission, tokens and anonymous media

**Files:** create `event-registrations.ts`, `security/event-form-token.ts`, `media/event-upload.ts`; modify `media/storage.ts`, `media/validation.ts` and media read policy; add `src/app/api/events/[id]/context/route.ts`, `registrations/route.ts`, `uploads/route.ts`; tests `backend/event-token.test.ts`, `backend/integration/event-registrations.test.ts`, `event-media.test.ts`.

**Interfaces:** `submitEventRegistration(input:{eventId,revisionId,idempotencyKey,answers},ownerDigest,ctx):Promise<{code:string}>`; `issueEventFormToken(eventId,revisionId):string`, `verifyEventFormToken(token):{eventId,revisionId,ownerDigest,expiresAt}`; `registerEventUpload({token,questionId,bytes,mime},ctx):Promise<{id,name}>`.

- [ ] RED tests: all-optional empty response accepted; wrong event/revision, hidden answer, unknown option and tampered/expired token rejected; concurrent requests with quota1 yield exactly one registration. Replay same key/body returns original code, changed body under same key conflicts.

```ts
const attempts = await Promise.allSettled([
  submitEventRegistration(inputA, ownerA, ctx),
  submitEventRegistration(inputB, ownerB, ctx),
]);
assert.equal(attempts.filter(x=>x.status==="fulfilled").length, 1);
assert.equal(await getDb().eventRegistration.count({where:{eventId}}), 1);
```

- [ ] Implement signed short-lived token scoped event/revision/random owner, exact Origin validation, body limit, bounded honeypot and database throttle with pseudonymous key. Context GET exposes only active form/public data and token, no participant information. POST checks idempotency before capacity/date rejection for already committed requests; replays require identical payload digest/owner. Transaction locks event, rereads state/revision/window, validates answers, capacity and commits response/audit without private answer payload in audit.
- [ ] Anonymous media validates token/question upload type, size/signature, sanitizes image or accepted PDF, scans quarantined original, creates private pending media with owner digest. Do not manufacture admin Principal or bypass existing upload authorization. Submission locks/validates owner, purpose/scannedAt, unbound state and binds file IDs in same transaction. Failed submission retains pending upload for retry within expiry; stale cleanup targets only expired unbound event media with validated paths. Read route requires events permission and freshness.
- [ ] Add tests for scanner unavailable/infected/timeout and guessed other-owner media rejected, bound file cannot be reused, anonymous/POH media reads rejected, cleanup preserves bound media. Test HTTP no Origin, oversized body, throttle and stale form conflict. Run backend unit/integration suite. Native scanner availability remains explicit operational prerequisite; no bypass for localhost.

## Task 4: Admin editor and management routes

**Files:** create backend `events.tsx`, event editor/question editor/form renderer files and `src/app/api/admin/events/route.ts`, `[id]/publish/route.ts`, `[id]/responses/route.ts`; modify admin catch-all and `backend/admin-shell.tsx`; add `tests/event-editor-ui.test.ts`.

**Interfaces:** `EventEditor({initial:EventAdminDto,csrfToken,onSaved})`, `EventFormRenderer({form,answers,onChange,disabled,issues})`; save API accepts shared schema with version, publish API only id/version. Admin responses API accepts validated page/cursor/filter and returns only authorized selected event data.

- [ ] Write SSR tests: Event in allowed role menu only, editor tabs/accessible labels, field required defaults false, form preview no submission button to real endpoint. Unit-test reorder/duplicate reducer rather than test-only production branches:

```ts
const duplicated = duplicateQuestion(form, questionId);
assert.notEqual(duplicated.items[1].id, form.items[0].id);
assert.deepEqual(duplicated.items[1].options?.map(x=>x.label), form.items[0].options?.map(x=>x.label));
```

- [ ] Observe RED, then implement editor state reducer with stable IDs, fresh option/row IDs on duplication, remapped local conditions, move-up/down keyboard controls and drag reorder. Meaning-changing edits use new question ID and explicitly warn if referenced by branch rules; deleting reference requires resolving dependent conditions. Add error summary and per-question messages. No unsafe HTML render.
- [ ] Implement tabs Pertanyaan/Respons/Pengaturan, question type selector, custom choices/Other/grid/ranges, help/required toggle, sections/conditional visibility, template button, full-width mobile and split canvas/context toolbar desktop. Use existing color/type tokens. Draft save busy protection, unsaved-change warning, preview modes and confirm publication; keep successful commit separate from failed refresh to avoid duplicate save/publish.
- [ ] Wire permission-guarded admin route into existing catch-all, avoid rendering preview/localStorage event mutations in backend. Verify HTTP RBAC/CSRF, posted staleversion409 and no duplicate publish on double click. Run UI suites/typecheck/lint. Record screenshot-based visual limitation, not browser approval.

## Task 5: Public event cards, form and navigation

**Files:** create `src/components/events/event-pages.tsx`; modify `components/public-pages.tsx`, `components/shell.tsx`, `server/public-data.ts`, `lib/types.ts` for explicit public event DTO only; add `src/app/event.css`; tests `tests/event-public-ui.test.ts`, backend public DTO/HTTP integration tests.

**Interfaces:** `EventPages({id?:string})` consumes public DTO list/detail/context. It maintains answers/idempotency key/token locally for current page only; never persists participant answers into existing organization localStorage store. `form-renderer.tsx` shared with preview validates visible fields.

- [ ] RED tests: nav Event adjacent OR/Donasi after Kontak only when published active event exists; posters have contained/original ratio layout; closed event form not accepting; public state serializes no registrations/ownerDigest/private media.
- [ ] Add public event list/detail, descriptions/poster/optional metadata, register action, shared form renderer for every supported kind, section navigation and accessible validation. Optional empty fields remain empty. Dates/numbers use appropriate controls, identifiers remain text. Expose no fake events/dates/seeds in backend mode.
- [ ] Obtain context token, upload through anonymous secure endpoint and submit with frozen attempt key. Disable repeat clicks; retry network uncertainty with same key. On stale form, retain compatible answers by stable ID and ask user to review new form; retired/changed IDs excluded explicitly. If commit succeeded show code even if later refresh fails; do not auto-resubmit.
- [ ] Validate mobile overflow/control alignment via CSS and SSR assertions, run actual HTTP flow token→submit→admin response, test every field optional form and closed-during-fill. Preserve existing campaigns/recruitment routes and navigation. Request screenshot review only after functional verification.

## Task 6: Responses and safe Excel export

**Files:** create `src/server/domains/event-export.ts`, `components/events/event-responses.tsx`, `src/app/api/admin/events/[id]/export/route.ts`; tests `tests/backend/event-export.test.ts`, `backend/integration/event-export.test.ts`.

**Interfaces:** `listEventRegistrations(principal,eventId,filter):Promise<{rows:RegistrationDto[],cursor:string|null}>`; `exportEventWorkbook({event,registrations,revisions}):Promise<Buffer>`; `loadEventExport(principal,eventId,filter):Promise<Buffer>` loads repeatable-read snapshot. Filter: revisionId/from/to/query with strict parsing and identical list/export semantics.

- [ ] RED ExcelJS reopen test with `00123`, `=HYPERLINK(...)`, duplicate question labels, historical options renamed and retired fields. Assert exact registration count, strings remain strings, cell.value is not formula object, distinct stable-ID columns and uploaded media has no capability URL.

```ts
const book = new ExcelJS.Workbook();
await book.xlsx.load(await exportEventWorkbook(exportFixture()));
const cell = book.getWorksheet("Pendaftar")!.getCell("D2");
assert.equal(cell.value, "00123");
assert.equal(cell.type, ExcelJS.ValueType.String);
assert.equal(book.worksheets.length, 2);
```

- [ ] Implement authorized paginated list/detail with historic snapshot labels and bounded text searching; no extra participants from another event. Respond with safe question-level errors, not generic lost values. Add selected-version/range filtering and empty export with headers.
- [ ] Server export has Pendaftar and Kamus pertanyaan sheets. Union historic question IDs in first occurrence order, ID-shortened columns resolve equal labels. Checkbox/grid human-readable label mapping from exact revision, numeric values only for number/scale, text cells for identifiers/expressions. Header frozen/filter/column widths; time labelled WIB. File references contain name/ID only. No raw private data in audit.
- [ ] Export cap 10,000 rows and 100 MiB estimated workbook data before allocation; require narrowing filters if exceeded, return explicit limit error without partial file. Use consistent transaction snapshot so concurrent registration/edit cannot split metadata/rows. Set attachment content type/name, private no-store and session authorization. Run roundtrip Excel tests and HTTP export without session/POH/cross-event filters.

## Task 7: Regression, local handoff and operations

**Files:** update `docs/backend-operations-ledger.md`, `docs/codegraph-map.md`, plan checkboxes and event-specific server operation notes.

- [ ] Run full commands sequentially where isolated DB/HTTP test lifecycle requires it: `npm test`, `npm run test:backend`, `npm run test:backend:integration`, `npm run typecheck`, `npm run lint`, `npm run build`. Record counts/exitcodes and warnings. Do not claim screenshot visual verification or native scanner success based on mocks.
- [ ] Ensure migration8/client loaded by local dev: restart only verified Dev_Website next process if client refresh requires, preserving DB/sessions. Check health via HTTP and authenticated module routing with test account in isolated database, not overwriting user's credentials. Leave devserver3000 running for user review.
- [ ] CodeGraph `sync`, inspect health, then add Event implementation state and remaining operational restrictions to map. Exclude private upload/source outputs; no indexing WAPALA parent. Review role transitions/session revocation/HTTP error redaction and source ZIP privacy boundaries.
- [ ] Run one fresh whole-change review after tests using requesting-code-review workflow. Address actionable findings with failing regression tests before fixes and rerun relevant/full verification. No deployment, public GitHub upload or credential changes in this feature task.
- [ ] Handoff functional Event routes/admin access/export with explicit **Check UI!!!**. State any scanner/local integration limitation. Do not say whole WAPALA backend or deployment finished unless separately completed.

## Plan self-review / handoff

All approved spec sections map to tasks1–7. Public uploads require task3 security before task5 accepts them; renderer shared task4/5. Backend independent IDs/revisions precede editor, so no temporary mock persistence is necessary. Existing underlying media validations must be tested for PDF before enabling participant PDFs. Five Review Focus cases each have an explicit owner/test above.

Planning only: no product code, migrations or user data have been changed. Per writing-plans workflow, user review of this written plan is the remaining prerequisite before native implementation begins.
