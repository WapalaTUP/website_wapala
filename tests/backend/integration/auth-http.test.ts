import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import sharp from "sharp";
import { unlink } from "node:fs/promises";
import { mediaRoot, mediaPath } from "../../../src/server/media/paths";
import { getDb } from "../../../src/server/db";
import { clean, ctx } from "./helpers";
import {
  createBootstrapToken,
  bootstrap,
} from "../../../src/server/auth/bootstrap";
const base = "http://127.0.0.1:3107";
let server: ChildProcess;
before(async () => {
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3107",
    ],
    {
      env: { ...process.env, NODE_ENV: "development", WAPALA_TEST_HTTP: "1" },
      windowsHide: true,
      stdio: "ignore",
    },
  );
  for (let i = 0; i < 80; i++) {
    try {
      await fetch(base + "/api/health");
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error("Local HTTP server unavailable");
});
beforeEach(async () => {
  await clean();
  const token = await createBootstrapToken(ctx);
  await bootstrap(
    { token: token.token, password: "test-http-passphrase" },
    ctx,
  );
});
after(async () => {
  server?.kill();
  await getDb().$disconnect();
});
async function authContext() {
  const r = await fetch(base + "/api/auth/context");
  assert.equal(r.status, 200);
  return {
    cookie: r.headers.get("set-cookie")!.split(";")[0],
    csrf: (await r.json()).csrfToken as string,
  };
}
async function post(
  path: string,
  body: unknown,
  context: { cookie: string; csrf: string },
) {
  return fetch(base + path, {
    method: "POST",
    headers: {
      origin: base,
      "content-type": "application/json",
      cookie: context.cookie,
      "x-csrf-token": context.csrf,
    },
    body: JSON.stringify(body),
  });
}
async function signIn() {
  const pre = await authContext(),
    r = await post(
      "/api/auth/login",
      { email: "superuser@wapala.org", password: "test-http-passphrase" },
      pre,
    );
  assert.equal(r.status, 200);
  const body = await r.json();
  return {
    cookie: r.headers.get("set-cookie")!.split(";")[0],
    csrf: body.csrfToken as string,
    response: r,
  };
}

test(
  "native scanner HTTP uploads persist usable gallery and Event photos",
  {
    skip: process.env.WAPALA_TEST_NATIVE_SCANNER !== "1",
  },
  async () => {
    const admin = await signIn();
    const bytes = await sharp({
      create: { width: 24, height: 40, channels: 3, background: "green" },
    })
      .png()
      .toBuffer();
    const uploaded: string[] = [];
    try {
      for (const purpose of ["content", "event-poster"]) {
        const form = new FormData();
        form.set("purpose", purpose);
        form.set(
          "file",
          new Blob([new Uint8Array(bytes)], { type: "image/png" }),
          "photo.png",
        );
        const response = await fetch(base + "/api/admin/media", {
          method: "POST",
          headers: {
            origin: base,
            cookie: admin.cookie,
            "x-csrf-token": admin.csrf,
            "x-media-purpose": purpose,
          },
          body: form,
        });
        const image = await response.json();
        assert.equal(response.status, 201, JSON.stringify(image));
        uploaded.push(image.id);
        const row = await getDb().media.findUniqueOrThrow({
          where: { id: image.id },
        });
        assert.ok(row.scannedAt);
        const file = await fetch(base + image.url);
        assert.equal(file.status, 200);
        assert.equal(
          (await sharp(Buffer.from(await file.arrayBuffer())).metadata())
            .height,
          40,
        );
        if (purpose === "content") {
          const gallery = await post(
            "/api/admin/records/galeri",
            {
              fields: {
                judul: "Album scanner HTTP",
                kategori: "Kegiatan",
                lokasi: "",
                sampul: image.url,
                deskripsi: "Foto nyata dipindai",
                tanggal: "",
                tanggal_upload: "",
                highlight: "Tidak",
                status: "Publik",
                gambar: [image.url],
              },
            },
            admin,
          );
        assert.equal(gallery.status, 200, await gallery.text());
        } else {
          const event = await post(
            "/api/admin/events",
            {
              title: "Event scanner HTTP",
              description: "",
              cover: "",
              poster: image.url,
              location: "",
              eventAt: "",
              start: "",
              end: "",
              quota: null,
              form: { title: "Form", description: "", items: [] },
            },
            admin,
          );
          assert.equal(event.status, 201, await event.text());
        }
      }
    } finally {
      for (const id of uploaded)
        await unlink(mediaPath(mediaRoot(), id, "webp"));
    }
  },
);
test("Event HTTP flow publishes form registers participant and exports session-only Excel", async () => {
  const admin = await signIn();
  assert.equal((await fetch(base + "/api/admin/events")).status, 401);
  const draft = {
    title: "Camp Fire HTTP",
    description: "Kegiatan WAPALA",
    cover: "",
    poster: "",
    location: "",
    eventAt: "",
    start: "",
    end: "",
    quota: 2,
    form: { title: "Pendaftaran", description: "", items: [] },
  };
  const savedResponse = await post("/api/admin/events", draft, admin);
  assert.equal(savedResponse.status, 201);
  const saved = await savedResponse.json();
  const publish = await post(
    "/api/admin/events/action",
    { id: saved.id, version: saved.version, action: "publish" },
    admin,
  );
  assert.equal(publish.status, 200);
  const contextResponse = await fetch(
    base + "/api/events/" + saved.id + "/context",
  );
  assert.equal(contextResponse.status, 200);
  const context = await contextResponse.json();
  const body = {
    eventId: saved.id,
    revisionId: context.event.revisionId,
    idempotencyKey: randomUUID(),
    answers: {},
  };
  const send = (origin: string) =>
    fetch(base + "/api/events/" + saved.id + "/registrations", {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        "x-event-token": context.token,
      },
      body: JSON.stringify(body),
    });
  assert.equal((await send("https://bad.example")).status, 403);
  const response = await send(base);
  assert.equal(response.status, 201);
  const receipt = await response.json();
  assert.match(receipt.code, /^EVT-/);
  const replay = await send(base);
  assert.equal((await replay.json()).code, receipt.code);
  const rows = await fetch(
    base + "/api/admin/events/" + saved.id + "/responses",
    { headers: { cookie: admin.cookie } },
  );
  assert.equal((await rows.json()).total, 1);
  assert.equal(
    (await fetch(base + "/api/admin/events/" + saved.id + "/export")).status,
    401,
  );
  const excel = await fetch(
    base + "/api/admin/events/" + saved.id + "/export",
    { headers: { cookie: admin.cookie } },
  );
  assert.equal(excel.status, 200);
  assert.match(excel.headers.get("content-type")!, /spreadsheetml/);
  assert.match(excel.headers.get("cache-control")!, /no-store/);
  assert.ok((await excel.arrayBuffer()).byteLength > 1000);
  const html = await fetch(base + "/admin/event", {
    headers: { cookie: admin.cookie },
  });
  assert.equal(html.status, 200);
  assert.match(await html.text(), /Camp Fire HTTP/);
  const state = await fetch(base + "/api/events");
  assert.equal(state.status, 200);
  assert.doesNotMatch(await state.text(), /idempotencyKey|ownerDigest|EVT-/);
  const reconciled = await fetch(
    base + "/api/events/" + saved.id + "/reconcile",
    {
      method: "POST",
      headers: {
        origin: base,
        "content-type": "application/json",
        "x-event-token": context.token,
      },
      body: JSON.stringify(body),
    },
  );
  assert.equal(reconciled.status, 200);
  assert.equal((await reconciled.json()).code, receipt.code);
});

test("refreshing auth context preserves the valid cookie token across tabs and repeated loads", async () => {
  const first = await authContext();
  const responses = await Promise.all(
    [0, 1].map(() =>
      fetch(base + "/api/auth/context", { headers: { cookie: first.cookie } }),
    ),
  );
  for (const response of responses) {
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.csrfToken, first.csrf);
    assert.equal(
      response.headers.get("set-cookie")!.split(";")[0],
      first.cookie,
    );
  }
});
test("HTTP login uses HttpOnly cookie without exposing a session token in JSON", async () => {
  const r = await signIn();
  assert.match(r.response.headers.get("set-cookie")!, /HttpOnly/i);
  assert.match(r.response.headers.get("set-cookie")!, /SameSite=Lax/i);
  assert.equal(r.response.headers.get("cache-control"), "no-store");
  const me = await fetch(base + "/api/auth/me", {
    headers: { cookie: r.cookie },
  });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.role, "SUPER_USER");
  const logout = await post("/api/auth/logout", {}, r);
  assert.equal(logout.status, 200);
  assert.equal(
    (await fetch(base + "/api/auth/me", { headers: { cookie: r.cookie } }))
      .status,
    401,
  );
});
test("HTTP rejects forged origin, missing CSRF and role spoofed login", async () => {
  const pre = await authContext();
  const bad = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: {
      origin: "https://attacker.org",
      "content-type": "application/json",
      cookie: pre.cookie,
      "x-csrf-token": pre.csrf,
    },
    body: JSON.stringify({
      email: "superuser@wapala.org",
      password: "test-http-passphrase",
    }),
  });
  assert.equal(bad.status, 403);
  const missing = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { origin: base, "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(missing.status, 403);
  assert.equal(
    (
      await post(
        "/api/auth/login",
        {
          email: "superuser@wapala.org",
          password: "test-http-passphrase",
          role: "SUPER_USER",
        },
        pre,
      )
    ).status,
    400,
  );
});
test("HTTP admin API enforces roles and omits credential fields", async () => {
  const su = await signIn();
  const created = await post(
    "/api/admin/users",
    { email: "POH@wapala.org", name: "POH", role: "POH" },
    su,
  );
  assert.equal(created.status, 201);
  const account = await created.json();
  const pre = await authContext();
  const poh = await post(
    "/api/auth/login",
    { email: "POH@wapala.org", password: account.temporaryPassword },
    pre,
  );
  const pohBody = await poh.json();
  const denied = await fetch(base + "/api/admin/users", {
    headers: { cookie: poh.headers.get("set-cookie")!.split(";")[0] },
  });
  assert.equal(denied.status, 403);
  const list = await fetch(base + "/api/admin/users", {
    headers: { cookie: su.cookie },
  });
  assert.equal(list.status, 200);
  assert.ok(!(await list.text()).includes("passwordHash"));
  assert.equal(pohBody.redirectTo, "/wapala/password");
});
test("server admin pages ignore forged demo role cookies and storage hints", async () => {
  const r = await fetch(base + "/admin/anggota", {
    redirect: "manual",
    headers: { cookie: "wapala.demo.role=Super%20User" },
  });
  assert.ok([302, 303, 307, 308].includes(r.status));
  assert.equal(new URL(r.headers.get("location")!, base).pathname, "/wapala");
  const page = await fetch(base + "/wapala");
  assert.equal(page.status, 200);
  assert.ok(!(await page.text()).includes("wapala-demo"));
});
test("readiness health reports database status without server credentials", async () => {
  const response = await fetch(base + "/api/health");
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.equal(JSON.parse(text).status, "ok");
  assert.ok(!text.includes("postgresql://"));
});
test("auth rejects unknown action and settings rejects secret or feature flag writes", async () => {
  const su = await signIn();
  assert.equal((await post("/api/auth/not-an-action", {}, su)).status, 404);
  const r = await fetch(base + "/api/admin/settings", {
    method: "PATCH",
    headers: {
      origin: base,
      "content-type": "application/json",
      cookie: su.cookie,
      "x-csrf-token": su.csrf,
    },
    body: JSON.stringify({
      SMTP_PASSWORD: "should-not-store",
      recruitmentActive: true,
    }),
  });
  assert.equal(r.status, 400);
  assert.equal(
    (await getDb().siteSettings.findUniqueOrThrow({ where: { id: 1 } }))
      .recruitmentActive,
    false,
  );
  const page = await fetch(base + "/wapala");
  assert.equal(page.headers.get("x-content-type-options"), "nosniff");
  assert.ok(page.headers.get("content-security-policy")?.includes("nonce-"));
});
test("campaign HTTP endpoints enforce cookie authorization, versions and private/public DTO separation", async () => {
  const su = await signIn();
  const created = await post(
    "/api/admin/campaigns",
    {
      title: "Kampanye HTTP",
      description: "Keterangan kampanye",
      target: 1000000,
      collaborator: "Uji",
      start: "",
      end: "",
      status: "active",
      cover: "",
      poster: "",
      qrisImage: "",
      bankAccounts: [
        {
          id: randomUUID(),
          bank: "Bank Uji",
          number: "0012345",
          holder: "Penerima Uji",
        },
      ],
    },
    su,
  );
  assert.equal(created.status, 201);
  const campaign = await created.json();
  assert.equal(campaign.version, 1);
  assert.equal((await fetch(base + "/api/admin/campaigns")).status, 401);
  const list = await fetch(base + "/api/public/campaigns");
  assert.equal(list.status, 200);
  const body = await list.json();
  assert.equal(body.campaigns[0].title, "Kampanye HTTP");
  assert.equal(body.campaigns[0].total, 0);
  assert.ok(!JSON.stringify(body).includes("donations"));
});
test("annual OR and atomic member import are exposed only through authorized APIs", async () => {
  const su = await signIn();
  const period = await post(
    "/api/admin/recruitment",
    { year: 2026, active: true },
    su,
  );
  assert.equal(period.status, 200);
  assert.equal((await period.json()).label, "Periode 2026");
  const imported = await post(
    "/api/admin/members/import",
    {
      rows: [
        {
          nama: "Member HTTP",
          nim: "00123",
          nia: "0001",
          prodi: "Teknik",
          angkatan: "2026",
          jenis_kelamin: "Laki-laki",
          status: "Aktif",
          kontak: "081234567890",
        },
      ],
    },
    su,
  );
  assert.equal(imported.status, 201);
  assert.equal((await imported.json()).imported, 1);
  const rows = await fetch(base + "/api/admin/records/anggota", {
    headers: { cookie: su.cookie },
  });
  assert.equal(rows.status, 200);
  assert.equal((await rows.json()).records[0].fields.nim, "00123");
  assert.equal((await fetch(base + "/api/admin/records/anggota")).status, 401);
});
test("inventory and management APIs persist authorized data and reject anonymous mutations", async () => {
  const su = await signIn();
  const equipment = await post(
    "/api/admin/inventory",
    {
      code: "00001",
      name: "Tenda",
      category: "Camp",
      total: 2,
      fit: 2,
      condition: "Baik",
      location: "Sekretariat",
      available: false,
      maxDays: 7,
      maxQuantity: 2,
      notes: "",
    },
    su,
  );
  assert.equal(equipment.status, 201);
  const row = await equipment.json();
  assert.equal(row.code, "00001");
  const anonymous = await fetch(base + "/api/admin/management", {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({
      expectedYear: 2026,
      year: 2027,
      passwordChoices: [],
    }),
  });
  assert.equal(anonymous.status, 401);
  const rolled = await post(
    "/api/admin/management",
    { expectedYear: 2026, year: 2027, passwordChoices: [] },
    su,
  );
  assert.equal(rolled.status, 200);
  assert.equal((await rolled.json()).year, 2027);
});
test("backend campaign admin page uses actual database data instead of placeholder or preview controls", async () => {
  const su = await signIn();
  await post(
    "/api/admin/campaigns",
    {
      title: "Kampanye Database Nyata",
      description: "Keterangan penerima",
      target: 1000000,
      collaborator: "Uji",
      start: "",
      end: "",
      status: "draft",
      cover: "",
      poster: "",
      qrisImage: "",
      bankAccounts: [],
    },
    su,
  );
  const page = await fetch(base + "/admin/donasi", {
    headers: { cookie: su.cookie },
  });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.ok(html.includes("Kampanye Database Nyata"));
  assert.ok(!html.includes("Modul sedang dihubungkan."));
  assert.ok(!html.includes("Role preview"));
});
test("media upload route denies anonymous requests and disguised files before registration", async () => {
  const su = await signIn();
  const body = new FormData();
  body.set("purpose", "campaign");
  body.set(
    "file",
    new Blob(["<script>alert(1)</script>"], { type: "image/jpeg" }),
    "photo.jpg",
  );
  const headers = { origin: base, "x-media-purpose": "campaign" };
  assert.equal(
    (await fetch(base + "/api/admin/media", { method: "POST", headers, body }))
      .status,
    401,
  );
  const result = await fetch(base + "/api/admin/media", {
    method: "POST",
    headers: { ...headers, cookie: su.cookie, "x-csrf-token": su.csrf },
    body,
  });
  assert.equal(result.status, 400);
  assert.equal(await getDb().media.count(), 0);
});
test("backend members and recruitment pages render database rows through guarded modules", async () => {
  const su = await signIn();
  await post(
    "/api/admin/members/import",
    {
      rows: [
        {
          nama: "Anggota Modul Nyata",
          nim: "00123",
          nia: "0001",
          prodi: "Teknik",
          angkatan: "2026",
          jenis_kelamin: "Laki-laki",
          status: "Aktif",
          kontak: "081234567890",
        },
      ],
    },
    su,
  );
  const members = await fetch(base + "/admin/anggota", {
    headers: { cookie: su.cookie },
  });
  assert.equal(members.status, 200);
  assert.ok((await members.text()).includes("Anggota Modul Nyata"));
  await post("/api/admin/recruitment", { year: 2026, active: true }, su);
  const recruitment = await fetch(base + "/admin/or", {
    headers: { cookie: su.cookie },
  });
  assert.equal(recruitment.status, 200);
  assert.ok((await recruitment.text()).includes("Periode 2026"));
});

test("backend inventory page renders persisted stock rather than the integration placeholder", async () => {
  const su = await signIn();
  const response = await post(
    "/api/admin/inventory",
    {
      code: "00200",
      name: "Tenda Database Nyata",
      category: "Camp",
      brand: "",
      typeColor: "",
      source: "",
      yearEntered: "",
      photo: "",
      total: 3,
      fit: 2,
      condition: "Baik",
      location: "Gudang privat",
      available: true,
      maxDays: 7,
      maxQuantity: 2,
      notes: "",
    },
    su,
  );
  assert.equal(response.status, 201);
  const page = await fetch(base + "/admin/inventaris", {
    headers: { cookie: su.cookie },
  });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.ok(html.includes("Tenda Database Nyata"));
  assert.ok(!html.includes("Modul sedang dihubungkan."));
});

test("Super User account page renders database identities without credential hashes", async () => {
  const su = await signIn();
  const created = await post(
    "/api/admin/users",
    { email: "POH@wapala.org", name: "Admin POH Organisasi", role: "POH" },
    su,
  );
  assert.equal(created.status, 201);
  const page = await fetch(base + "/admin/pengguna", {
    headers: { cookie: su.cookie },
  });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.ok(html.includes("Admin POH Organisasi"));
  assert.ok(html.includes("poh@wapala.org"));
  assert.ok(!html.includes("passwordHash"));
  assert.ok(!html.includes("$argon2id$"));
});

test("management rollover page displays real year and separate admin password choices", async () => {
  const su = await signIn();
  await post(
    "/api/admin/users",
    {
      email: "Logistik@wapala.org",
      name: "Admin Logistik Periode",
      role: "INVENTARIS",
    },
    su,
  );
  const page = await fetch(base + "/admin/kepengurusan", {
    headers: { cookie: su.cookie },
  });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.ok(html.includes("Admin Logistik Periode"));
  assert.ok(html.includes("Pertahankan password"));
  assert.ok(html.includes("Ganti password baru"));
  assert.ok(html.includes("2026"));
});

test("admin landing uses the full role-based shell instead of the foundation transition page", async () => {
  const su = await signIn();
  const page = await fetch(base + "/admin/foundation", {
    headers: { cookie: su.cookie },
  });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.ok(html.includes('aria-label="Modul admin"'));
  assert.ok(html.includes("Ringkasan organisasi"));
});
test("remaining admin modules render guarded database data in the shared shell", async () => {
  const su = await signIn();
  await fetch(base + "/api/admin/settings", {
    method: "PATCH",
    headers: {
      origin: base,
      "content-type": "application/json",
      cookie: su.cookie,
      "x-csrf-token": su.csrf,
    },
    body: JSON.stringify({ organization: "Organisasi Uji Pengaturan" }),
  });
  await post(
    "/api/admin/members/import",
    {
      rows: [
        {
          nama: "Anggota Arsip Nyata",
          nia: "00033",
          nim: "00044",
          prodi: "Teknik",
          angkatan: "2026",
          jenis_kelamin: "Laki-laki",
          status: "Aktif",
          kontak: "081234567890",
        },
      ],
    },
    su,
  );
  await getDb().member.updateMany({ data: { archivedAt: new Date() } });
  const inventory = await post(
    "/api/admin/inventory",
    {
      code: "00301",
      name: "Alat Peminjaman Nyata",
      category: "Camp",
      brand: "",
      typeColor: "",
      source: "",
      yearEntered: "",
      photo: "",
      total: 3,
      fit: 3,
      condition: "Baik",
      location: "Gudang",
      available: true,
      maxDays: 7,
      maxQuantity: 2,
      notes: "",
    },
    su,
  );
  const equipment = await inventory.json();
  const { requestLoan } = await import("../../../src/server/domains/loans");
  const receipt = await requestLoan(
    {
      institution: "Organisasi Peminjam Nyata",
      pic: "PIC Uji",
      phone: "081234567890",
      email: "pic@example.invalid",
      start: "2050-01-01",
      end: "2050-01-02",
      purpose: "Latihan",
      event: "Latihan lapangan",
      collateral: "KTM",
      items: [{ equipmentId: equipment.id, requested: 1 }],
    },
    ctx,
  );
  for (const [path, expected] of [
    ["peminjaman", receipt.code],
    ["pengaturan", "Organisasi Uji Pengaturan"],
    ["arsip", "Anggota Arsip Nyata"],
    ["audit", "MEMBERS_IMPORTED"],
  ]) {
    const page = await fetch(base + "/admin/" + path, {
      headers: { cookie: su.cookie },
    });
    assert.equal(page.status, 200, path);
    const html = await page.text();
    assert.ok(html.includes('aria-label="Modul admin"'), path);
    assert.ok(html.includes(expected), path + " actual database row");
    assert.ok(!html.includes("Modul sedang dihubungkan."), path);
  }
});
