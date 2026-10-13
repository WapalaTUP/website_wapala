import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FoundationHome } from "../src/components/auth/foundation-home";
test("backend login landing exposes relevant modules without a preview role switch", () => {
  const html = renderToStaticMarkup(
    createElement(FoundationHome, {
      name: "Logistik",
      role: "INVENTARIS",
      csrfToken: "test",
    }),
  );
  assert.ok(html.includes('href="/admin/inventaris"'));
  assert.ok(html.includes('href="/admin/peminjaman"'));
  assert.ok(!html.includes('href="/admin/pengguna"'));
  assert.ok(!html.includes("Role preview"));
});
test("Super User landing includes account management and rollover", () => {
  const html = renderToStaticMarkup(
    createElement(FoundationHome, {
      name: "Super User",
      role: "SUPER_USER",
      csrfToken: "test",
    }),
  );
  assert.ok(html.includes('href="/admin/pengguna"'));
  assert.ok(html.includes('href="/admin/kepengurusan"'));
});
