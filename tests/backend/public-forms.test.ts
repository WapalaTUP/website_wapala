import test from "node:test";
import assert from "node:assert/strict";

process.env.APP_URL = "https://wapala.example";
process.env.DATABASE_URL = "postgresql://localhost/wapala_test";
process.env.SECURITY_KEY = Buffer.alloc(32, 7).toString("base64");

test("public forms do not require a third-party verification provider", async () => {
  const mod = await import("../../src/server/domains/public-forms");
  assert.equal(
    mod.publicSubmitSchema.safeParse({
      kind: "loan",
      idempotencyKey: "12345678-1234-4234-8234-123456789012",
      consent: true,
      payload: {},
    }).success,
    true,
  );
  assert.equal(
    mod.publicLookupSchema.safeParse({
      kind: "loan",
      code: "WPL-TEST",
      phone: "081234567890",
    }).success,
    true,
  );
});

test("public owner and capabilities reject tampering and record-purpose substitution", async () => {
  const mod = await import("../../src/server/domains/public-forms");
  const cookie = mod.issueFormOwner();
  const owner = mod.verifyFormOwner(cookie);
  assert.equal(owner.length, 43);
  assert.throws(() => mod.verifyFormOwner(cookie + "bad"));
  const token = mod.issuePublicCapability(
    "loan",
    "12345678-1234-4234-8234-123456789012",
    owner,
  );
  assert.equal(mod.verifyPublicCapability(token, owner, "loan").kind, "loan");
  assert.throws(() => mod.verifyPublicCapability(token, owner, "recruitment"));
  assert.throws(() => mod.verifyPublicCapability(token, "wrong-owner", "loan"));
});
