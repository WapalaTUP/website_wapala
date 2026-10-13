# WAPALA Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat fondasi backend 2A yang memiliki PostgreSQL nyata, setup Super User aman, sesi database, RBAC, pemulihan email/SSH dan audit, teruji tanpa mengoperasikan browser.

**Architecture:** Next.js Route Handlers memanggil service server dengan Prisma/PostgreSQL. Transport, policy, transaksi, email worker dan UI login dipisahkan. Domain operasional belum dihubungkan hingga rencana 2B; jangan membuka portal demo sebagai portal backend yang aman.

**Tech Stack:** Next.js 16.4.0 existing, Node.js 24 development, TypeScript, Prisma/@prisma/client/@prisma/adapter-pg 7.10.0 stable (bukan latest 8 RC), pg, Zod 4, argon2, Nodemailer, node:test/tsx. Pin versi dependency saat instalasi setelah rencana disetujui; jangan mengubah dependency Next/React unrelated.

**Spec:** `docs/superpowers/specs/2026-10-13-backend-design.md` — disetujui pengguna 13 Oktober 2026. Rencana ini hanya 2A. 2B/2C adalah pekerjaan berikutnya, bukan fitur yang diklaim selesai bersama fondasi.

## Global Constraints

- Target Ubuntu versi 22 atau lebih baru, VPS khusus yang masih kosong, RAM 2 GB, tanpa Docker untuk produksi.
- Next.js + TypeScript terpadu, PostgreSQL, Prisma. Vercel hanya pertanyaan kompatibilitas, bukan perubahan target.
- Super User: `superuser@wapala.org`; email pemulihan: `Wapalatelkomuniversity@gmail.com`.
- Identitas admin: `POH@wapala.org`, `Logistik@wapala.org`, `Kerjasama@wapala.org`.
- Autentikasi memakai sesi database dan cookie HttpOnly, bukan token login di localStorage. Password Argon2id.
- Pemulihan lewat email sebagai jalur utama, perintah SSH sebagai fallback.
- Tidak mengoperasikan browser; pengguna meninjau UI melalui screenshot.
- Tidak ada seed demo produksi. OR/kampanye awal nonaktif; bootstrap membuat akun pertama tanpa password default.
- Tidak mengindeks Src, generated output atau credentials. CodeGraph CLI wrapper digunakan untuk discovery dan sync kode.
- Tidak ada Git repository; tidak menginisialisasi/commit diam-diam. Catat checkpoint/test/ruling di `docs/backend-foundation-ledger.md` sebagai pengganti langkah commit.
- Jangan install service OS, meminta secrets di chat, mengubah VPS atau mengirim email nyata. Database test native harus tersedia dan disetujui; bila belum, lanjut pekerjaan unit yang independen namun laporkan tes integrasi belum dijalankan.
- Baca dokumentasi Next lokal sebelum setiap API framework baru. Cookie API async; auth response no-store; semua route backend Node runtime.

## Review Focus

1. Dua bootstrap/reset serentak: satu menang, satu gagal tanpa akun/token duplikat (Tasks 2, 4, 5).
2. SMTP timeout setelah pesan diterima: retry tidak membuka token ganda atau mengirim pesan tanpa batas; token sensitif tidak tersimpan plaintext (Task 5).
3. Header proxy/IP palsu: throttle tidak bisa dilewati dengan X-Forwarded-For pengguna; trusted proxy eksplisit (Task 3).
4. Client role palsu dan sesi must-change: tidak bisa membaca domain admin atau membuka endpoint pengguna (Tasks 4, 6, 7).
5. Salah database/env: runner integration tidak menghapus database produksi dan build tidak membutuhkan koneksi DB atau SMTP (Tasks 1, 8).

## File map dan kontrak bersama

- `prisma/schema.prisma`, `prisma/migrations/*`, `prisma/seed.ts`, `prisma.config.ts`: model/migration/seed, tanpa data demo.
- `src/generated/prisma/`: generated, excluded Git/ESLint/CodeGraph/source ZIP, dibangun ulang lewat generate.
- `src/server/config.ts`, `db.ts`, `errors.ts`: env lazy tervalidasi, pool singleton, error publik terkontrol.
- `src/server/security/{password,tokens,csrf,throttle,request-context}.ts`: primitive keamanan terpisah.
- `src/server/audit.ts`, `src/server/auth/{bootstrap,sessions,login,recovery,users,policy}.ts`: transaksi dan otorisasi domain.
- `src/server/email/{outbox,transport,worker}.ts`: penyimpanan envelope terenkripsi dan worker.
- `src/server/http/{body,auth-handler}.ts`, `src/app/api/auth/*/route.ts`, `src/app/api/admin/*/route.ts`, `src/app/api/health/route.ts`: boundary HTTP.
- `src/components/auth/{portal-login,password-change,password-reset,foundation-home}.tsx`: UI tipis, tidak membawa Prisma/token server ke browser.
- `scripts/{bootstrap-token,recover-superuser,email-worker,backend-integration}.ts`, `scripts/terminal-password.ts`: CLI aman dan runner test.
- `tests/backend/*.test.ts` unit; `tests/backend/integration/*.test.ts` database nyata terpisah dari glob frontend existing.
- `.env.example`, `docs/backend-local-setup.md`, `docs/backend-foundation-ledger.md`: konfigurasi tanpa secrets, setup dan bukti.

Tipe bersama (di `src/server/auth/policy.ts`):

```ts
export type Role = 'SUPER_USER'|'POH'|'MULTIMEDIA'|'INVENTARIS';
export type Permission = 'users:read'|'users:write'|'audit:read'|'settings:read'|'settings:write'|'members:read'|'members:write'|'content:write'|'recruitment:read'|'recruitment:write'|'inventory:write'|'loans:write'|'campaigns:write';
export type Principal = { userId: string; sessionId: string; role: Role; mustChangePassword: boolean };
export type RequestContext = { ipDigest: string; userAgent: string; requestId: string };
```

`Principal` selalu berasal dari database. Parameter `role`/`actor` dari client tidak digunakan. Service auth menerima `RequestContext` aman. Audit menerima `Prisma.TransactionClient`, aktor USER atau SERVER_OPERATOR dan ringkasan allowlisted. Unit memakai dependency injection clock/password/random/email; integration memakai PostgreSQL nyata, bukan adapter in-memory yang dianggap ekuivalen.

### Task 1: Database dan konfigurasi yang bisa dibuild tanpa koneksi

**Files:** Create `prisma.config.ts`, `prisma/schema.prisma`, `src/server/{config,db,errors}.ts`, `.env.example`, `scripts/backend-integration.ts`, `tests/backend/config.test.ts`; modify `package.json`, `.gitignore`, `eslint.config.mjs`, `codegraph.json`; document `docs/backend-local-setup.md`.

**Interfaces:** `parseConfig(input: Record<string,string|undefined>): ServerConfig`; `getConfig(): ServerConfig`; `getDb(): PrismaClient`; `DomainError(code: string, status: number)`; `validateTestDatabaseUrl(testUrl: string, productionUrl?: string): URL`; singleton lazy, bukan koneksi saat module import. ServerConfig memuat appOrigin, databaseUrl, securityKey Buffer, production, trustProxy, emailMode dan opsi SMTP worker.

- [ ] Write failing config tests, preserving environment through injected values rather than mutating process globally:

```ts
test('production rejects insecure origins and weak secrets', () => {
  assert.throws(() => parseConfig({ NODE_ENV:'production', APP_URL:'http://example.org', DATABASE_URL:'postgresql://test@localhost/wapala', SECURITY_KEY:'short' }));
});
test('missing env produces a redacted configuration error', () => {
  assert.throws(() => parseConfig({}), /konfigurasi/i);
});
```

- [ ] Run `npx tsx --test tests/backend/config.test.ts` and verify RED for missing implementation.
- [ ] Install pinned compatible Prisma 7.10.0 trio, pg, Zod 4, argon2, Nodemailer, server-only and required type packages. Record versions/lockfile. Prisma config loads env explicitly for CLI; datasource provider PostgreSQL; generator `prisma-client`, output `../src/generated/prisma`. Exclude output from indexing/lint/source packaging. Add scripts `db:generate`, `db:migrate`, `db:seed`, `test:backend`, `test:backend:integration`.
- [ ] Implement strict config: APP_URL origin only, HTTPS production; DATABASE_URL PostgreSQL only; SECURITY_KEY base64 exactly 32 bytes; TRUST_PROXY defaults false; production SMTP variables required only for SMTP worker, not build; explicit delivery mode `sink` development or `smtp` production; no secret included in errors. Pool max 5, lazy creation and development hot-reload singleton.

```ts
const parsed = new URL(input.APP_URL);
if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new DomainError('CONFIG_INVALID', 503);
if (input.NODE_ENV === 'production' && parsed.protocol !== 'https:') throw new DomainError('CONFIG_INVALID', 503);
```

- [ ] Implement runner requiring `TEST_DATABASE_URL` with database name suffix `_test`, reject equality with DATABASE_URL, disallow production mode; do not drop whole database. A random per-run schema is created/migrated and destroyed after verifying exact schema prefix `wapala_test_`. Generate from test config, never overwrite user env files. No database detected yet: document native install prerequisite instead of silent service installation.
- [ ] Run config tests, `db:generate`, `typecheck`, `build` without live database; verify build does not instantiate connection. Record checkpoint in ledger.

### Task 2: Migration, bootstrap transaction and append-only audit

**Files:** Create `prisma/migrations/<timestamp>_auth_foundation/migration.sql`, `prisma/seed.ts`, `src/server/{audit.ts,security/tokens.ts,auth/bootstrap.ts}`, `scripts/bootstrap-token.ts`, `tests/backend/tokens.test.ts`, `tests/backend/integration/bootstrap.test.ts`.

**Interfaces:** `newToken(): string` (32 random bytes base64url); `digestToken(raw: string): string` (SHA256); `writeAudit(tx, event): Promise<void>`; `createBootstrapToken(ctx): Promise<{token:string;expiresAt:Date}>`; `bootstrap({token,password},ctx): Promise<void>`.

- [ ] RED tests: token uniqueness/entropy length, digest not plaintext; seed twice leaves one BootstrapState/SiteSettings, zero users/sessions/operational fixtures. Integration bootstrap race uses Promise.allSettled, asserts one SUPER_USER, replay rejected, expired token rejected, audit failure rolls back account and token consumption.

```ts
const outcomes = await Promise.allSettled([bootstrap(input, ctx), bootstrap(input, ctx)]);
assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
assert.equal(await db.user.count({where:{role:'SUPER_USER'}}), 1);
assert.equal(await db.session.count(), 0);
```

- [ ] Run unit and integration file separately; RED must be correct missing/behavior failure, not absent database. If DB absent, do not label integration RED/GREEN measured.
- [ ] Create schema: User (unique normalized email, role, passwordHash, mustChangePassword, active/archive and lock fields); Session (unique digest, user FK, csrfDigest, dates/revocation); PasswordResetToken (digest/user/expiry/usedAt); singleton BootstrapState (id=1,digest/expiry/completedAt); singleton SiteSettings (managementYear, recruitmentActive=false, config Json); AuditLog; SecurityThrottle; EmailOutbox. Add required indexes, foreign keys and CHECKs; avoid storing raw tokens/passwords.
- [ ] Serialize bootstrap by parameterized `SELECT ... FOR UPDATE` on singleton row inside Prisma transaction. Hash password before lock, validate token inside lock, enforce fixed account `superuser@wapala.org`, recoveryEmail exact agreed Gmail, create audit atomically and null token digest after success. CLI creates setup token only while no completed bootstrap, TTL 30 min; emits once to operator, never application log.
- [ ] Add SQL trigger rejecting AuditLog UPDATE/DELETE and PostgreSQL GRANT example for separate runtime vs migration roles; test runtime denial while cleanup uses isolated-schema owner. Audit summaries cannot contain password/token. Seed initializes fixed config only via upsert create + no overwriting existing settings.
- [ ] Verify migrations on empty test schema, seed idempotence, concurrency/audit tests GREEN. Record SQL review and checkpoint.

### Task 3: Password, CSRF, request limits and persistent throttle

**Files:** Create `src/server/security/{password,csrf,throttle,request-context}.ts`, `src/server/http/body.ts`, `tests/backend/security.test.ts`, `tests/backend/integration/throttle.test.ts`.

**Interfaces:** `hashPassword(password): Promise<string>`, `verifyPassword(hash,password): Promise<boolean>`, `validatePassword(password): void`; `assertOrigin(request): void`; `assertCsrf(request,principal): Promise<void>`; `readJson(request,schema,maxBytes=16384): Promise<ValidatedInput>`; `requestContext(request): RequestContext`; `takeThrottle(key,limit,windowMs): Promise<void>`.

- [ ] RED cases: 11-character password rejected, passphrase accepted, >1024 UTF8 bytes rejected before hashing; hash Argon2id not plaintext; wrong password false; forged/absent/null Origin denied on mutations; absent/stale CSRF denied; oversized streamed request rejected even when Content-Length absent; invalid JSON/type rejected without reflecting content.

```ts
test('untrusted X-Forwarded-For never selects a throttle identity', () => {
  const a = requestContext(new Request('http://127.0.0.1',{headers:{'x-forwarded-for':'attacker'}}));
  const b = requestContext(new Request('http://127.0.0.1',{headers:{'x-forwarded-for':'changed'}}));
  assert.equal(a.ipDigest, b.ipDigest);
});
```

- [ ] Run targeted tests and inspect RED. Implement Argon2id memoryCost=19456 KiB, timeCost=2, parallelism=1; max two hashing jobs active and bounded queue (reject overflow generically), byte cap before verify. Compute a dummy hash once for unknown user; benchmark later on target server, not claim 2GB performance measured locally.
- [ ] CSRF: generate token at session creation, digest persisted; authenticated GET token refresh may rotate CSRF via explicit POST instead, GET only returns active token through encrypted session-bound token design. Use deterministic HMAC CSRF derived from opaque session token + SECURITY_KEY so server can issue token without DB plaintext; store digest on session. Header `X-CSRF-Token` compared timing-safe; Origin exact configured APP_URL. Pre-auth routes require signed pre-auth CSRF cookie/token from GET auth context, short TTL, bound to cookie; Login/Bootstrap/Reset require it too. No cookie-auth mutation except tightly defined pre-auth flow.
- [ ] readJson incrementally enforces byte cap; strict Zod request schemas reject client role spoof for login/bootstrap. RequestContext trusts forwarded client IP only if TRUST_PROXY enabled and reverse proxy is documented to overwrite forwarding headers; otherwise shared unknown bucket (safe reduced functionality), plus independent normalized email throttle. HMAC pseudonymizes IP, limits user-agent 256 chars.
- [ ] Implement atomic UPSERT counter per window and limits across workers; expired rows prune via maintenance, not unlimited table growth. Rate limit IP/email for login and recovery; transaction checks account counters under row lock. Run persistent concurrency tests; checkpoint.

### Task 4: Login, sessions, forced password change and RBAC

**Files:** Create `src/server/auth/{policy,sessions,login}.ts`, `tests/backend/policy.test.ts`, `tests/backend/integration/login.test.ts`.

**Interfaces:** `login({email,password},ctx): Promise<{token:string;csrfToken:string;principal:Principal;expiresAt:Date}>`; `resolveSession(token): Promise<Principal|null>`; `logout(token,ctx): Promise<void>`; `changePassword(principal,{currentPassword,newPassword},ctx): Promise<void>`; `requirePermission(principal, permission): void`.

- [ ] RED tests define permission matrix exhaustively, POH cannot inventory/users write, Inventaris cannot members write, all admins recruitment read; must-change sessions denied all operational permissions. Database tests expiry 30 days, archived/inactive rejection, reset revocation, login race escalation, injection email string, role ignored/rejected, exact case-insensitive identities, generic unknown/wrong/locked errors, logout replay.

```ts
assert.throws(() => requirePermission({...principal, role:'POH'},'users:write'));
assert.throws(() => requirePermission({...principal, mustChangePassword:true},'members:read'));
const session = await login({email:'superuser@wapala.org',password:fixturePassword}, ctx);
await logout(session.token, ctx);
assert.equal(await resolveSession(session.token), null);
```

- [ ] Implement database session verification every request: active user, not archived, session expiry/revoked and user mustChange. 30-day absolute expiry, no sliding extension. Password changes increment credential version and revoke all sessions, not silently keep old cookie. New login required.
- [ ] Login hashing outside lock but re-check passwordHash/version and lock state in transaction before success. Failure writes counters/audit despite returning generic error (do not throw before transaction commits failure record). First 3 lock 15min, next 3 after expiry require SU unlock. User lookup uses exact normalized Prisma query, never concatenated raw SQL. All failure responses indistinguishable except public rate limits; no credentials printed.
- [ ] Authenticated mutation locks user record to coordinate password reset/nonactive/account changes and forbid stale-role commits. Role is not claimed by cookie/client. Audit session creation/revocation and material account changes in same transaction.

```ts
const session = await getDb().session.findUnique({
  where: {tokenHash: digestToken(token)}, include: {user:true},
});
if (!session || session.revokedAt || session.expiresAt <= new Date()
  || !session.user.active || session.user.archivedAt) return null;
return {userId:session.userId, sessionId:session.id,
  role:session.user.role, mustChangePassword:session.user.mustChangePassword};
```
- [ ] Run unit/integration GREEN, ensure parallel hash/login does not bypass new credential reset, checkpoint.

### Task 5: Email/SSH recovery and durable outbox

**Files:** Create `src/server/auth/recovery.ts`, `src/server/email/{outbox,transport,worker}.ts`, `scripts/{recover-superuser,email-worker,terminal-password}.ts`, `tests/backend/recovery-cli.test.ts`, `tests/backend/integration/recovery.test.ts`.

**Interfaces:** `requestRecovery(email,ctx): Promise<void>` (always public generic result); `completeRecovery({token,newPassword},ctx): Promise<void>`; `recoverSuperuser(password,ctx): Promise<void>` CLI only; `enqueueEmail(tx,envelope): Promise<void>`; `deliverOutbox(transport,batchSize=5): Promise<DeliveryReport>`; `MailTransport.send(envelope,idempotencyKey): Promise<void>`.

- [ ] RED expiry/reuse/race tests, unknown-email response sameness, APP_URL not Host reset link, no raw reset token in database/log and no email to login alias when fixed recoveryEmail exists; test SSH refuses password arguments/non-TTY, cancellation produces no mutation, password not echoed; test worker retries bounded, concurrent workers claim one job, sink records only in isolated tests.

```ts
await requestRecovery('superuser@wapala.org', ctx);
const message = await captureTestMail();
assert.equal(message.to, 'Wapalatelkomuniversity@gmail.com');
const r = await Promise.allSettled([completeRecovery(input,ctx),completeRecovery(input,ctx)]);
assert.equal(r.filter(x => x.status === 'fulfilled').length, 1);
assert.equal(await resolveSession(oldSessionToken), null);
```

- [ ] Implement random 30min token, only digest persisted. Transaction user lock revokes prior unused tokens, creates reset token and email outbox together. Encrypt outbox body containing reset link with AES-256-GCM random IV and SECURITY_KEY; authenticated encryption rejects tampering. SMTP credentials never persist in DB.
- [ ] Consume token under lock with expiry and usedAt check; hash before transaction, update user/revoke sessions/all other tokens/unlock/audit atomic. Do not reactivate archived user through public recovery. SSH only fixed SU email, terminal hidden prompt+confirmation, audit SERVER_OPERATOR, no new arbitrary account if bootstrap absent.

```ts
// Inside the same transaction, after locked token/user validity checks:
await tx.user.update({where:{id:user.id},data:{passwordHash,
  mustChangePassword:false,failedLoginCount:0,lockUntil:null,requiresUnlock:false}});
await tx.session.updateMany({where:{userId:user.id,revokedAt:null},data:{revokedAt:now}});
await tx.passwordResetToken.updateMany({where:{userId:user.id,usedAt:null},data:{usedAt:now}});
await writeAudit(tx,{actorType:'USER',actorId:user.id,action:'PASSWORD_RECOVERED',context:ctx});
```
- [ ] Worker uses lease/claim transaction, deterministic Message-ID, exponential retry up to 5, transient/permanent result, clears encrypted sensitive payload when delivered/expired. SMTP is at-least-once: timeout may send duplicate email but same one-time token, never claim exactly-once delivery. Reset expiry independent of retries. Sink only dev/test; production does not fall back to sink on missing SMTP. Store sanitized error class, never SMTP response bodies containing secrets.
- [ ] Run targeted tests GREEN; no real SMTP network/send. Document local SMTP test sink and SSH operation; checkpoint.

### Task 6: Admin user management/settings/audit server API

**Files:** Create `src/server/auth/users.ts`, `src/server/settings.ts`, `src/server/http/auth-handler.ts`, `src/app/api/admin/{users,settings,audit}/route.ts`, `src/app/api/admin/users/[id]/route.ts`, `tests/backend/integration/admin-api.test.ts`.

**Interfaces:** `createAdmin(principal,{email,name,role},ctx): Promise<{user:UserDto;temporaryPassword:string}>`; `updateAdmin(principal,id,input,ctx): Promise<UserDto>`; `resetAdminPassword(principal,id,ctx): Promise<{temporaryPassword:string}>`; `getSettings(principal): Promise<SettingsDto>`; `updateSettings(principal,input,ctx): Promise<SettingsDto>`; `listAudit(principal,{cursor,limit}): Promise<AuditPage>`.

- [ ] RED unauthenticated401, wrong-role403, must-change403, client body actor/role bypass, lastSU nonactive forbidden, simultaneous twoSU deactivate cannot remove both, duplicate email409, explicit allowed roles; admin list never includes hashes/tokens. CSRF missing403. Audit pagination bounded (1..100), settings changes reject unknown keys/feature enabling outside 2A.

```ts
const result = await callAdminUsers({cookie:pohCookie,csrf:pohCsrf,body:{email:'fake@example.org',role:'SUPER_USER',actor:'Super User'}});
assert.equal(result.status, 403);
assert.equal(await db.user.count({where:{email:'fake@example.org'}}),0);
```

- [ ] Services derive actor from Principal, recheck under transaction, protect last activeSU with consistent locking order, audit atomically. Generated temporary password minimum 20 chars, returned only once to SU, flagged mustChange, no email real send for admin account defaults. User API cannot set arbitrary hash/recovery email/session version. SU can reset/unlock eligible users; own/SU reset through separate recovery/password-confirmed actions. Settings allow safe contact config only, not arbitrary SMTP secrets.
- [ ] Route wrappers map known DomainError to generic JSON code/Indonesian message and unknown errors500 with requestId; no stack/SQL/rawdata response. Content-type JSON required, no-store auth/private responses, enforce size/schema/session/permission/Origin/CSRF before service. Audit list excludes secret envelopes; sanitized useragent, integer limits.

```ts
requirePermission(principal,'users:write');
const temporaryPassword = newToken();
const passwordHash = await hashPassword(temporaryPassword);
// Role/principal freshness is rechecked under the transaction lock.
const user = await tx.user.create({data:{email:normalizedEmail,name,
  role,passwordHash,mustChangePassword:true,active:true}});
await writeAudit(tx,{actorType:'USER',actorId:principal.userId,
  action:'USER_CREATED',entityId:user.id,context:ctx});
// Explicit DTO excludes hashes/reset/session tokens; no audit password payload.
return {user:{id:user.id,email:user.email,name:user.name,role:user.role},temporaryPassword};
```
- [ ] Run API tests against actual HTTP process/testDB, not direct service calls only; checkpoint.

### Task 7: Auth transport/login UI and server page guards

**Files:** Create `src/app/api/auth/{context,bootstrap,login,logout,password,recovery,reset,me}/route.ts`, `src/components/auth/{portal-login,password-change,password-reset,foundation-home}.tsx`, `src/app/admin/foundation/page.tsx`, `src/app/wapala/{password,reset}/page.tsx`; modify `src/app/wapala/page.tsx`, `src/app/admin/[[...module]]/page.tsx`, `next.config.ts`; test `tests/backend/integration/auth-http.test.ts`, `tests/backend/auth-ui.test.ts`.

**Interfaces:** GET context `{setupRequired, csrfToken}` only, preauth signed cookie; POST bootstrap input token/password; POST login email/password, sets session cookie; GET me `{user:{id,name,role,mustChangePassword},csrfToken}`; POST logout/password/recovery/reset. Auth success returns fixed destinations `/admin/foundation` or `/wapala/password`, never user supplied redirect URL.

- [ ] RED tests fetch no browser: cookie HttpOnly/SameSite=Lax/Secure production, no cookie domain, absolute maxAge30days, no token in JSON/log; unknown Origin/loginCSRF denied; bootstrap context does not leak account details; no demo password/role dropdown in rendered real-login form; server pages deny forged sessionStorage/localStorage roles; forced-change and reset use token via form, no referrer leak.

```ts
const response = await fetch(base+'/api/auth/login',{method:'POST',headers:csrfHeaders,body:JSON.stringify({email,password})});
const cookie = response.headers.get('set-cookie')!;
assert.match(cookie,/HttpOnly/i);
assert.match(cookie,/SameSite=Lax/i);
assert.ok(!JSON.stringify(await response.json()).includes(sessionToken));
```

- [ ] Implement real Login component separately instead of extending 2k-line admin module. Keep logo/typography existing; setup token and password confirmation when pending; login without role selector; forgotpassword generic, reset route noindex/no-referrer and removes token from URL before form interaction. Only password/session endpoint receives raw secrets.
- [ ] Server page guard resolves cookie with `await cookies()`, redirects absent session to `/wapala`, must-change to password page. Until 2B integrated, real login opens foundation home with account/session actions; all legacy admin module paths show explicit backend-module-not-yet-connected placeholder behind permission checks, NOT demo records or client role switch. Preserve frontend preview in separate explicitly development-only mode (`WAPALA_MODE=preview`, prohibited NODE_ENV=production), no authentication claims for preview. Browser-only role persistence never trusted by backend.

```ts
const cookieStore = await cookies();
const principal = await resolveSession(cookieStore.get('wapala.session')?.value ?? '');
if (!principal) redirect('/wapala');
if (principal.mustChangePassword) redirect('/wapala/password');
// Module permission is checked before rendering a placeholder or module DTO.
```
- [ ] Headers directly Next: nosniff, referrerPolicy, frame-ancestors policy through CSP, restrictive permissions-policy; HSTS only HTTPS production. CSP nonce integration must preserve Next scripts/fonts and existing maps/image allowances explicit, no blanket unsafe-inline/unsafe-eval in production. Unit assert prod/dev policies; trusted proxy documented for Nginx later.
- [ ] Run HTTP/SSR tests, frontend suite/typecheck/lint/build; manually review TSX hooks/labels/loading/cancel/error and no accidental server imports in client. No browser. Checkpoint.

### Task 8: Full verification, safety evidence and handoff

**Files:** Update `docs/backend-local-setup.md`, `docs/backend-handoff.md`, `docs/codegraph-map.md`, `docs/backend-foundation-ledger.md`; create `tests/backend/integration/migration-health.test.ts`, `src/app/api/health/route.ts`.

**Interfaces:** GET health `{status:'ok'|'degraded',requestId}` without credentials/settings; readiness DB connectivity returns503 when unavailable. Health does not publish engine/database version or host.

- [ ] RED test healthDBdown503 sanitized, no dependencyconnection at build, invalid testDATABASE refuses before SQL schema operations, cleanDB migrations/seed preserve no demo, restart persists bootstrapclosed/user/session state.

```ts
assert.throws(() => validateTestDatabaseUrl(productionUrl, productionUrl));
assert.throws(() => validateTestDatabaseUrl('postgresql://test@localhost/wapala', productionUrl));
const response = await fetch(base+'/api/health');
assert.ok([200,503].includes(response.status));
assert.ok(!JSON.stringify(await response.json()).includes('postgresql://'));
```

- [ ] Implement readiness via lazy DB bounded timeout; test runner disposable schema validation ensures cleanup exact generated schema, never broad DROP database. Document env variable names only, native PostgreSQL localsetup, migrationrole/runtime grants, commands for bootstrap/recovery/worker, dev SMTP sink, test proof and reset does not initialize demo.

```ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await getDb().$queryRaw`SELECT 1`;
    return Response.json({status:'ok'},{headers:{'Cache-Control':'no-store'}});
  } catch {
    return Response.json({status:'degraded'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
// Pool acquisition/query timeouts are configured in db.ts, not an uncancelled Promise race.
```
- [ ] Run `npm test`, `npm run test:backend`, `npm run test:backend:integration`, `npm run typecheck`, `npm run lint`, `npm run build`, dependency audit; inspect actual output/exitcodes. If native DB still unavailable, final status incomplete with exact integration gap, not stage2A complete. No browser is a known UAT constraint, not evidence UI verified.
- [ ] CodeGraph sync/query new serverentrypoints and verify generated/database/media/privateSource excluded. Single final security/code review per executing-plans skill; only Critical/Important fixes require reproduced regression, minor findings documented honestly.
- [ ] Update ledger spec coverage: 2A implemented/tested or blocked; 2B domainAPIs, 2C import/ZIP and stage3deploy NOT complete. No ZIP promised delivered now. Hand off local server test commands and remaining infrastructure needs, no production deployment/email.

## Self-review and execution handoff

Coverage: spec foundation models/config/audit Tasks1–2, bootstrap2, requestsecurity3, authRBAC4, recoveryemailSSH5, adminaccounts/settings6, login/guards/headers7, health/migrations/testproof8. Domain2B/import2C explicitly separate follow-ups. Review focus covered bootstrap2/reset5, SMTP5, trustedproxy3, role/must-change4/6/7, database/build1/8. Dependency signatures fixed in file map; no unnamed external function in code examples is production contract (testfixture helpers local to tests).

Integration prerequisite: native PostgreSQL CLI/service was not detected on development PC. Do not silently install; determine a user-approved local native instance before claiming database tests pass. VPS access is not needed for local implementation. No secrets printed.

Proposed execution method: Native (same session), because services share transactions/contracts and one implementer limits cross-task drift/token cost. User already requested execution; required plan-review gate still applies to this newly written artifact. On confirmation use executing-plans, maintain ledger and one final fresh reviewer, no per-task agent fanout.
