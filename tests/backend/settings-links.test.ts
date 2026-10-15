import test from "node:test";
import assert from "node:assert/strict";
import { settingsSchema } from "../../src/server/settings";
test("branding accepts only uploaded media references or clearing", () => {
  assert.equal(
    settingsSchema.safeParse({
      logoUrl: "/api/media/12345678-1234-4234-8234-123456789abc",
      identityImageUrl: "",
    }).success,
    true,
  );
  for (const logoUrl of [
    "https://example.org/logo.png",
    "/brand/logo.svg",
    "javascript:alert(1)",
  ])
    assert.equal(settingsSchema.safeParse({ logoUrl }).success, false);
});
test("organization social and map settings accept HTTPS or clearing and reject active URLs", () => {
  assert.equal(
    settingsSchema.safeParse({
      map: "https://maps.google.com/?q=WAPALA",
      instagram: "https://instagram.com/wapala",
      tiktok: "",
      youtube: "https://youtube.com/@wapala",
    }).success,
    true,
  );
  for (const map of [
    "javascript:alert(1)",
    "http://maps.google.com",
    "https://user:password@maps.google.com",
  ])
    assert.equal(settingsSchema.safeParse({ map }).success, false);
});
