import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../../../src/server/db";
import { clean, ctx } from "./helpers";
import {
  createBootstrapToken,
  bootstrap,
} from "../../../src/server/auth/bootstrap";
import { login } from "../../../src/server/auth/login";
import { logout } from "../../../src/server/auth/sessions";
import type { Principal } from "../../../src/server/auth/policy";
let principal: Principal, token: string;
const service = () =>
  import("../../../src/server/domains/campaigns").catch(() => null);
const fixture = (title = "Uji kampanye") => ({
  title,
  description: "Keterangan penerima dan kegiatan",
  target: 1000000,
  collaborator: "Organisasi uji",
  start: "",
  end: "",
  status: "active" as const,
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
});
beforeEach(async () => {
  await clean();
  const setup = await createBootstrapToken(ctx);
  await bootstrap(
    { token: setup.token, password: "campaign-test-passphrase" },
    ctx,
  );
  const session = await login(
    { email: "superuser@wapala.org", password: "campaign-test-passphrase" },
    ctx,
  );
  principal = session.principal;
  token = session.token;
});
after(() => getDb().$disconnect());
test("separate campaigns retain multiple bank accounts and reject duplicate accounts", async () => {
  const m = await service();
  assert.ok(m, "Campaign service exists");
  const draft = fixture();
  draft.bankAccounts.push({
    id: randomUUID(),
    bank: "Bank Kedua",
    number: "00987",
    holder: "Nama Kedua",
  });
  const a = await m.saveCampaign(principal, draft, ctx);
  await m.saveCampaign(principal, fixture("Kampanye berbeda"), ctx);
  assert.equal(a.bankAccounts[0].number, "0012345");
  assert.equal(a.bankAccounts[1].holder, "Nama Kedua");
  assert.equal((await m.publicCampaigns()).length, 2);
  await assert.rejects(
    m.saveCampaign(
      principal,
      {
        ...fixture(),
        bankAccounts: [
          draft.bankAccounts[0],
          { ...draft.bankAccounts[0], id: randomUUID() },
        ],
      },
      ctx,
    ),
  );
});
test("donation snapshots survive account edits and verification is idempotent under concurrency", async () => {
  const m = await service();
  assert.ok(m);
  const c = await m.saveCampaign(principal, fixture(), ctx);
  const receipt = await m.submitDonation(
    {
      campaignId: c.id,
      name: "Donatur Uji",
      amount: 25000,
      method: "bank",
      bankAccountId: c.bankAccounts[0].id,
      proof: "",
    },
    ctx,
  );
  const updated = await m.saveCampaign(
    principal,
    {
      ...c,
      bankAccounts: [
        { ...c.bankAccounts[0], holder: "Pemilik baru", number: "99876" },
      ],
    },
    ctx,
  );
  await Promise.all([
    m.reviewDonation(principal, receipt.id, "verified", "", ctx),
    m.reviewDonation(principal, receipt.id, "verified", "", ctx),
  ]);
  const rows = await m.listDonations(principal, c.id);
  assert.equal(
    rows[0].bankAccountLabel,
    "Bank Uji · 0012345 · a.n. Penerima Uji",
  );
  assert.equal((await m.publicCampaigns())[0].total, 25000);
  assert.equal(
    await getDb().auditLog.count({
      where: { action: "DONATION_VERIFIED", entityId: receipt.id },
    }),
    1,
  );
  assert.equal(updated.version, 2);
  await assert.rejects(
    m.saveCampaign(principal, c, ctx),
    (e: unknown) => e instanceof Error && "code" in e && e.code === "CONFLICT",
  );
});
test("closed campaigns reject new confirmations and public DTO excludes donors", async () => {
  const m = await service();
  assert.ok(m);
  const c = await m.saveCampaign(principal, fixture(), ctx);
  await m.saveCampaign(principal, { ...c, status: "closed" }, ctx);
  await assert.rejects(
    m.submitDonation(
      {
        campaignId: c.id,
        name: "Secret Donor",
        amount: 1000,
        method: "bank",
        bankAccountId: c.bankAccounts[0].id,
        proof: "",
      },
      ctx,
    ),
  );
  assert.deepEqual(await m.publicCampaigns(), []);
});
test("domain mutations reject revoked principals even after prior session resolution", async () => {
  const m = await service();
  assert.ok(m);
  await logout(token, ctx);
  await assert.rejects(m.saveCampaign(principal, fixture(), ctx));
});
test("an active donation campaign must offer at least one payment method", async () => {
  const m = await service(); assert.ok(m);
  await assert.rejects(m.saveCampaign(principal, { ...fixture(), bankAccounts: [] }, ctx));
});
