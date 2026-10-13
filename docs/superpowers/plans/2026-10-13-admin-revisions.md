# Admin Revisions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task if Native execution is approved. Steps use checkbox syntax for tracking.

**Goal:** Implement the approved multi-campaign/QRIS, member/equipment import, management-period rollover and admin-account preview revisions.

**Architecture:** Retain the local demo store but extract focused campaign, import and management modules. Introduce backward-compatible migration once at store hydration; UI writes retain audit records. These tasks are sequenced in one plan because they share DemoState migration, account permissions and admin navigation; each has an independently testable deliverable.

**Tech Stack:** Existing Next.js 16.4, TypeScript, React, ExcelJS, native browser file APIs, node:test/tsx and PowerShell CodeGraph CLI. No new production dependencies.

**Spec:** `../specs/2026-10-13-admin-revisions-design.md` — approved 13 October 2026.

## Global Constraints

- Frontend preview only; no backend, external uploads, real password changes or automatic Src imports.
- Keep demo records and audit history across migrations; never use resetStore for a feature migration.
- QRIS accepts JPG/PNG/WebP, maximum 5 MB; never generate a payment QR for invented account details.
- Only Super User sees/opens management reset. Archive returned/rejected loans; preserve unfinished loans and original period/history.
- OR period and management period are separate. Do not reset OR, campaigns, members or inventory stock during rollover.
- Three requested account identities: POH@wapala.org, Logistik@wapala.org, Kerjasama@wapala.org; roles remain POH, Inventaris, Multimedia.
- Maintain current themes, keyboard accessibility, responsive layout and no public login link.
- Use CodeGraph CLI first; source root is Dev_Website, not Src. No Git repository is configured: do not initialize Git or create commits merely for this plan.

## Review Focus

1. Repeated hydration/migration must not duplicate legacy campaigns, accounts or donation links.
2. A closed/archived campaign must reject confirmation even if its form was opened earlier.
3. XLSX numeric IDs formatted with leading zeroes and CSV quoted fields/newlines must survive parsing; formulas must never execute.
4. Switching import file/mapping must clear stale errors and pending confirmations; local storage quota failures must not masquerade as successful imports.
5. Pending, approved, borrowed, overdue and return-verification loans must remain unarchived; Super User cannot accidentally request their own reset in a bulk operation.

## Task 1: Campaign domain and legacy migration

**Create:** `src/lib/campaigns.ts`, `src/lib/preview-migration.ts`, `tests/campaigns.test.ts`.
**Modify:** `src/lib/types.ts`, `src/lib/seed.ts`, `src/lib/store.ts`.

**Interfaces:** Define `Campaign` with id, title, description, cover, qrisImage, target, bank, account, collaborator, start, end and status (`draft | active | closed | archived`). Add `campaignId` to Donation and `campaigns` to DemoState. Functions: `migratePreviewState(state: DemoState): DemoState`, `campaignTotal(donations: Donation[], campaignId: string): number`, `activeCampaigns(state: DemoState): Campaign[]`, `validateCampaign(c: Campaign): string`.

- [ ] Write migration, isolation, validation and idempotency tests using fictional fixtures. Preserve all existing loans/applicants/audit and honor an already-existing campaign collection.

```typescript
assert.equal(campaignTotal([
  { ...seed.donations[0], campaignId: 'a', amount: 100, status: 'Terverifikasi' },
  { ...seed.donations[0], campaignId: 'b', amount: 200, status: 'Terverifikasi' },
  { ...seed.donations[0], campaignId: 'a', amount: 300, status: 'Menunggu' },
], 'a'), 100);
assert.deepEqual(migratePreviewState(migratePreviewState(oldState)), migratePreviewState(oldState));
```

- [ ] Run `npx tsx --test tests/campaigns.test.ts`; observe missing behavior before implementation.
- [ ] Implement sum and active predicates exactly:

```typescript
return donations.filter(d => d.campaignId === campaignId && !d.archived && d.status === 'Terverifikasi').reduce((sum, d) => sum + d.amount, 0);
// activeCampaigns
return state.campaigns.filter(c => c.status === 'active');
```

- [ ] Migration maps settings.campaign* to stable `legacy-campaign`, links only donations missing campaignId, preserves activation from donationActive, initializes new fields without clobbering newer state. Chain after migrateAnnualPeriods in hydration and storage-event handling. Validate finite positive target, nonempty title/description and date ordering.
- [ ] Add clearly labeled fictional Marapi/Demak campaigns as inactive seed examples, with no fake QRIS/rekening. Run campaign tests, full `npm test` and typecheck; record result in this checklist.

## Task 2: Multi-campaign admin/public UI and QRIS

**Create:** `src/components/campaign-admin.tsx`, `src/components/campaign-pages.tsx`.
**Modify:** `src/components/admin.tsx`, `src/components/forms.tsx`, `src/components/public-pages.tsx`, `src/components/shell.tsx`, `src/app/polish.css`, `tests/campaigns.test.ts`.

**Interfaces:** `CampaignAdmin({role}:{role:Role})`, `CampaignPages({id}:{id?:string})`; public routes `/donasi` and `/donasi/:id`. Existing `DonationForm` takes `campaignId: string` and submits only if the selected campaign is still active.

- [ ] Add a predicate `canConfirmDonation(state: DemoState, id: string): boolean` in campaigns.ts and test stale-form closure:

```typescript
state.campaigns[0].status = 'closed';
assert.equal(canConfirmDonation(state, state.campaigns[0].id), false);
```

- [ ] Run the targeted test red, then implement with `.some(c => c.id === id && c.status === 'active')`.
- [ ] Extract DonationAdmin into CampaignAdmin. Use `canEdit(role, 'donasi')` for mutations and show per-campaign title, description, state, total/target, edit/activate/close and confirmation filter. Retain proof review and mandatory rejection reason.
- [ ] Build campaign fields with existing Field/Modal/Upload patterns. Read selected QRIS image as a data URL only after MIME/size validation; display it without cropping or distortion. Handle quota errors explicitly, retaining the editor draft and reporting persistence failure.
- [ ] Public listing/detail show active campaign title, description, cover, collaborator, progress and configured methods. Pass campaignId on every confirmation; reject zero/negative/non-finite amounts, missing method/proof and inactive campaign at submission. Do not expose donor lists.
- [ ] Replace navigation donationActive checks with `activeCampaigns(state).length > 0`; retain CTA right of Kontak. Load campaign pages dynamically. Remove dead single-campaign editor; retain legacy fields only for migration compatibility, not UI edits.
- [ ] Browser-test two active campaigns, distinct totals, uploaded fictional image preview, stale form after closing, role restrictions, narrow mobile form and no-method empty state. Run tests/typecheck/lint before recording completion.

## Task 3: Member and equipment import

**Create:** `src/lib/import-data.ts`, `src/lib/import-files.ts`, `src/components/import-dialog.tsx`, `tests/import.test.ts`.
**Modify:** `src/components/admin.tsx`, `src/lib/types.ts`, `src/lib/seed.ts`, `src/lib/store.ts`, `src/app/polish.css`.

**Interfaces:** `ImportKind = 'anggota' | 'inventaris'`; `ImportTable = {headers:string[]; rows:string[][]}`; `ImportPreview = {rows:Record<string,string>[]; errors:{row:number;field:string;message:string}[]}`. Implement `parseCsv(text:string):ImportTable`, `readImportFile(file:File):Promise<ImportTable>`, `validateImport(kind:ImportKind, table:ImportTable, mapping:Record<string,string>, state:DemoState):ImportPreview`, `applyImport(state:DemoState, kind:ImportKind, preview:ImportPreview):void`, `downloadImportTemplate(kind:ImportKind):Promise<void>`.

- [ ] Write red tests for quoted CSV/newlines, duplicate NIA/code within file/existing records, NIM conflict, missing required columns, invalid quantities and leading zeroes:

```typescript
assert.equal(parseCsv('NIA,NIM,Nama\r\n0007,00123,"Nama, Contoh"').rows[0][1], '00123');
assert.equal(parseCsv('Nama,Catatan\n"Contoh","Baris 1\nBaris 2"').rows[0][1], 'Baris 1\nBaris 2');
assert.throws(() => applyImport(state, 'anggota', { rows: [], errors: [{row: 2, field:'nia', message:'Duplikat'}] }));
```

- [ ] Run `npx tsx --test tests/import.test.ts`, then implement a quoted-field CSV state machine. Normalize BOM/headers, support comma or semicolon delimiters and escaped quotes. Reject duplicate mapped destination fields; compare identifiers as trimmed case-normalized text.
- [ ] Lazy-import ExcelJS in readImportFile. Limit file to 10 MB and 2,000 nonempty data rows; accept only CSV/XLSX, reject formulas and macro-enabled files. Read identifier cell text with number-format leading-zero preservation; reject unsupported cell value types rather than stringify objects. Test synthetic XLSX generated locally; no personal workbook inputs.
- [ ] Template member fields: nomor,nama,nim,prodi,angkatan,jenis_kelamin,nia,status,kontak,foto. Equipment fields: code,name,category,brand,typeColor,source,yearEntered,total,fit,condition,location,photo,notes. Add optional missing equipment fields with backward-compatible defaults; validate integers, fit<=total, allowed condition and URL/photo text.
- [ ] ImportDialog offers template download, fictional-data warning, file/mapping, preview/error table and confirmation. When file/mapping changes, clear any previously prepared confirmation. Block application if any error or zero data rows; revalidate against current store immediately before commit. Only add new records and audit a count/module summary.
- [ ] Make updateStore persistence failure observable and atomic before publishing state: serialize/store draft first, then update state/emit. Existing callers receive a visible failure notification rather than silent success. Add persistence-error regression tests using a minimal storage dependency seam without secrets.
- [ ] Attach the dialog only to authorized Members/Inventory views; no parser code in the homepage bundle. Run full test/typecheck/lint and test fixtures in browser on both roles and Super User.

## Task 4: Management-period rollover, account names and Oprec layout

**Create:** `src/lib/management.ts`, `src/components/management-reset.tsx`, `tests/management.test.ts`.
**Modify:** `src/lib/types.ts`, `src/lib/seed.ts`, `src/lib/preview-migration.ts`, `src/lib/domain.ts`, `src/components/admin.tsx`, `src/app/polish.css`.

**Interfaces:** Add Module `'kepengurusan'` only to Super User permissions. Add managementPeriod to Settings; optional originPeriod/managementPeriod to Loan; optional preview-only resetRequired/resetRequestedAt strings to records.pengguna fields. Define `PasswordChoice = 'keep' | 'request-new'`, `RolloverPreview = {archiveIds:string[];carryIds:string[];resetUserIds:string[]}`, `previewRollover(state:DemoState, year:string, choices:Record<string,PasswordChoice>):RolloverPreview`, `applyRollover(state:DemoState, year:string, choices:Record<string,PasswordChoice>, actor:Role):void`.

- [ ] Write red tests for every LoanStatus, repeated/year-invalid reset, roles, all preserved loan fields, and Super User excluded from bulk requests:

```typescript
const prior = structuredClone(state.loans);
applyRollover(state, '2027', {}, 'Super User');
for (const before of prior) {
  const after = state.loans.find(l => l.id === before.id)!;
  assert.deepEqual(after.history, before.history);
  assert.equal(Boolean(after.archived), Boolean(before.archived) || ['Dikembalikan','Ditolak'].includes(before.status));
}
assert.throws(() => applyRollover(state, '2028', {}, 'POH'));
```

- [ ] Run management tests red; implement a pure preview helper then apply the same result after confirmation. Validate four-digit management year >=2004, greater than current; ignore already-archived loans. Keep originPeriod immutable, update managementPeriod only on carried loans, never change stock/status/denda/jaminan.
- [ ] Migrate existing three role account records to requested emails only if they match the old seed/example identities; preserve custom user edits. Ensure one seed account per role, without duplicating on hydration. Do not change Super User identity or real login secrets.
- [ ] ManagementReset wizard selects next year, previews archived/carried counts, defaults all eligible users to keep password and allows individual request-new. Backend-only disclaimer accompanies reset requests. Separate Super User reset request modal with explicit confirmation; no password fields or credentials saved in browser.
- [ ] Apply one audit record summarizing year/counts/selected IDs; UI should show request-required status per selected user and make clear real credentials have not changed. Deny direct non-Super-User route in the preview handler as well as hiding navigation.
- [ ] Rework RecruitmentAdmin into current-period/status panel plus a distinct create-year section; place filter and both export buttons in one aligned responsive toolbar. Preserve annual period behavior and applicant rows.
- [ ] Run all tests/typecheck/lint and browser-test each role, pending/borrowed loan carry, empty history, confirmation cancellation, repeated reset, responsive Oprec and account labels.

## Task 5: Whole-flow verification and handoff

**Modify:** `docs/codegraph-map.md`, `docs/backend-handoff.md`, this plan's checkboxes.

- [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`; report any failure, including unrelated failures, before claiming completion.
- [ ] Use the computer-use skill and existing localhost browser for desktop/mobile QA; keep testing in temporary tabs, preserve the user's active tab and actual private files. Verify all four module flows and keyboard/error states.
- [ ] Request one independent scoped code review under the requesting-code-review skill, fix evidenced findings, and rerun affected checks. No implementation subagents unless the user chooses that method.
- [ ] Sync CodeGraph and confirm CampaignAdmin, ImportDialog and ManagementReset are queryable. Update the map from pending to verified preview accurately; retain backend-only distinctions.
- [ ] Save a screenshot of revised admin UI, keep localhost dev server available and finish with exactly `Check UI!!!`. Do not start backend or reset any real account.

## Execution review

Recommended method: Native (inline). The migration/store contracts are shared, so sequential implementation avoids competing edits and minimizes repeated context. Await the user's plan review and execution-method confirmation before changing application code.
# Execution amendment

User added multi-bank/recipient entries and a separate poster during execution. Extend campaign domain, migration, admin editor and public confirmation with RED→GREEN tests. User then prohibited browser use; remaining verification is automated and screenshot review by the user. No backend/deployment scope change.

