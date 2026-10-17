/** Local isolated database verification. Never connects to the production database. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { Client } from "pg";
import { parse } from "dotenv";
import assert from "node:assert/strict";
import { getDb } from "../src/server/db";
import { saveContent, listContent, publicContent } from "../src/server/domains/records";
import { restoreArchive } from "../src/server/domains/archives";
import { hashPassword } from "../src/server/security/password";
import { digestToken } from "../src/server/security/tokens";
import type { Principal } from "../src/server/auth/policy";
import { validateTestDatabaseUrl } from "../src/server/config";

async function main() {
  const local = parse(await readFile(".local/backend.env"));
  const base = new URL(local.DATABASE_URL);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(base.hostname))
    throw new Error("Only local PostgreSQL is allowed.");
  const url = new URL(base);
  url.pathname = "/wapala_content_test";
  url.search = "";
  validateTestDatabaseUrl(url.href, base.href);
  const admin = new Client({ connectionString: base.href });
  await admin.connect();
  try {
    if (
      !(await admin.query("SELECT 1 FROM pg_database WHERE datname='wapala_content_test'")).rowCount
    )
      await admin.query("CREATE DATABASE wapala_content_test");
  } finally {
    await admin.end();
  }
  const schema = "editorial_" + randomBytes(6).toString("hex");
  url.searchParams.set("schema", schema);
  process.env.DATABASE_URL = url.href;
  process.env.APP_URL = "http://127.0.0.1:3100";
  process.env.SECURITY_KEY = randomBytes(32).toString("base64");
  process.env.EMAIL_MODE = "disabled";
  process.env.MEDIA_ROOT = process.cwd() + "/.local/content-preview-media";
  const migrated = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { env: process.env, encoding: "utf8" },
  );
  if (migrated.status !== 0) throw new Error("Isolated test migration failed: " + migrated.stderr);
  const db = getDb();
  const context = {
    ipDigest: "local-test",
    userAgent: "content-integration",
    requestId: randomUUID(),
  };
  const passwordHash = await hashPassword("Wapala-local-review-2026!");
  async function principal(
    role: "ANGGOTA" | "MULTIMEDIA" | "SUPER_USER",
    suffix: string,
  ): Promise<Principal> {
    const user = await db.user.create({
      data: {
        email: `${suffix}@local.test`,
        name: suffix,
        role,
        passwordHash,
        mustChangePassword: false,
      },
    });
    const session = await db.session.create({
      data: {
        userId: user.id,
        tokenHash: digestToken(randomUUID()),
        csrfDigest: "test",
        credentialVersion: 0,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    return { userId: user.id, sessionId: session.id, role, mustChangePassword: false };
  }
  const member = await principal("ANGGOTA", "member"),
    other = await principal("ANGGOTA", "other"),
    editor = await principal("MULTIMEDIA", "multimedia"),
    su = await principal("SUPER_USER", "superuser");
  const fields = {
    judul: "Latihan navigasi bersama",
    slug: "latihan-navigasi-bersama",
    tipe: "Berita",
    penulis: "Spoofed author",
    tanggal: "2026-10-17",
    status: "Publik",
    ringkasan: "Catatan latihan Gunung Hutan WAPALA.",
    isi: "Naskah awal",
    tags: ["Gunung Hutan", "SAR"],
  };
  let row = await saveContent(member, "konten", { fields }, context);
  assert.equal(row.published, false);
  assert.equal((row.fields as Record<string, unknown>).penulis, "member");
  assert.equal((await publicContent("konten")).length, 0);
  await assert.rejects(() =>
    saveContent(
      other,
      "konten",
      { id: row.id, version: row.version, fields, action: "submit" },
      context,
    ),
  );
  await assert.rejects(() =>
    saveContent(
      member,
      "konten",
      { id: row.id, version: row.version, fields, action: "publish" },
      context,
    ),
  );
  row = await saveContent(
    member,
    "konten",
    { id: row.id, version: row.version, fields, action: "submit" },
    context,
  );
  assert.equal(row.workflowStatus, "submitted");
  await assert.rejects(() =>
    saveContent(
      member,
      "konten",
      { id: row.id, version: row.version, fields, action: "save" },
      context,
    ),
  );
  row = await saveContent(
    editor,
    "konten",
    {
      id: row.id,
      version: row.version,
      fields: { ...fields, penulis: "member", isi: "Versi disetujui" },
      action: "publish",
    },
    context,
  );
  const published = await publicContent("konten");
  assert.equal((published[0].fields as Record<string, unknown>).isi, "Versi disetujui");
  row = await saveContent(
    member,
    "konten",
    {
      id: row.id,
      version: row.version,
      fields: { ...fields, isi: "Draf rahasia belum disetujui" },
      action: "submit",
    },
    context,
  );
  let raw = await db.contentRecord.findUniqueOrThrow({ where: { id: row.id } });
  assert.equal((raw.fields as Record<string, unknown>).isi, "Versi disetujui");
  assert.equal("tags" in (raw.fields as Record<string, unknown>), false);
  assert.equal((await publicContent("konten"))[0].fields.isi, "Versi disetujui");
  assert.equal(
    ((await listContent(member, "konten"))[0].fields as Record<string, unknown>).isi,
    "Draf rahasia belum disetujui",
  );
  assert.equal((await listContent(other, "konten")).length, 0);
  await assert.rejects(() =>
    saveContent(
      editor,
      "konten",
      { id: row.id, version: row.version, fields, action: "return" },
      context,
    ),
  );
  row = await saveContent(
    editor,
    "konten",
    {
      id: row.id,
      version: row.version,
      fields: { ...fields, isi: "Perbaiki lokasi" },
      action: "return",
      note: "Tambahkan lokasi latihan.",
    },
    context,
  );
  assert.equal(row.workflowStatus, "returned");
  assert.equal(row.reviewNote, "Tambahkan lokasi latihan.");
  row = await saveContent(
    member,
    "konten",
    {
      id: row.id,
      version: row.version,
      fields: { ...fields, isi: "Revisi penulis" },
      action: "submit",
    },
    context,
  );
  const staleVersion = row.version;
  row = await saveContent(
    editor,
    "konten",
    {
      id: row.id,
      version: row.version,
      fields: { ...fields, isi: "Revisi disetujui" },
      action: "publish",
    },
    context,
  );
  await assert.rejects(() =>
    saveContent(
      editor,
      "konten",
      { id: row.id, version: staleVersion, fields, action: "publish" },
      context,
    ),
  );
  assert.equal((await publicContent("konten"))[0].fields.isi, "Revisi disetujui");
  // Old main can still parse/edit legacy fields; no new JSON keys are exposed to it.
  raw = await db.contentRecord.findUniqueOrThrow({ where: { id: row.id } });
  const legacyKeys = [
    "judul",
    "slug",
    "tipe",
    "kategori",
    "penulis",
    "tanggal",
    "sampul",
    "status",
    "ringkasan",
    "isi",
  ];
  assert.ok(Object.keys(raw.fields as object).every((key) => legacyKeys.includes(key)));
  row = await saveContent(
    editor,
    "konten",
    { id: row.id, version: row.version, fields, archived: true },
    context,
  );
  raw = await db.contentRecord.findUniqueOrThrow({ where: { id: row.id } });
  assert.equal((await publicContent("konten")).length, 0);
  await restoreArchive(
    su,
    { id: row.id, kind: "konten", at: raw.archivedAt!.toISOString() },
    context,
  );
  raw = await db.contentRecord.findUniqueOrThrow({ where: { id: row.id } });
  assert.equal(raw.workflowStatus, "draft");
  assert.equal(raw.published, false);
  assert.equal(raw.draftFields, null);
  // Leave one reviewed article for browser QA in this isolated schema.
  await saveContent(
    editor,
    "konten",
    {
      id: row.id,
      version: raw.version,
      fields: {
        ...fields,
        penulis: "member",
        isi: "Setiap perjalanan dimulai dari persiapan.\n\nLatihan bersama menjadi ruang untuk mengenali medan dan menjaga kekompakan tim.",
      },
      action: "publish",
    },
    context,
  );
  await mkdir(".local", { recursive: true });
  await writeFile(
    ".local/content-preview.env",
    Object.entries({
      DATABASE_URL: process.env.DATABASE_URL!,
      SECURITY_KEY: process.env.SECURITY_KEY!,
      APP_URL: process.env.APP_URL!,
      EMAIL_MODE: "disabled",
      MEDIA_ROOT: process.env.MEDIA_ROOT!,
      WAPALA_MODE: "backend",
    })
      .map(([key, value]) => `${key}=${value}`)
      .join("\n"),
  );
  console.log(
    "PASS: isolated migration, ownership, forged publish, review lock, revision snapshots, legacy compatibility, stale versions, return/resubmit/publish, archive restore.",
  );
  console.log("Preview database prepared in isolated schema " + schema + ".");
  await db.$disconnect();
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Integration verification failed.");
  process.exit(1);
});
