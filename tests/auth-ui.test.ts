import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PortalLogin } from "../src/components/auth/portal-login";
test("real login renders accessible identity/password controls without demo role selector", () => {
  const html = renderToStaticMarkup(createElement(PortalLogin)).toLowerCase();
  assert.ok(html.includes("superuser@wapala.org"));
  assert.ok(html.includes('autocomplete="username"'));
  assert.ok(html.includes('autocomplete="current-password"'));
  assert.ok(!html.includes("wapala-demo"));
  assert.ok(!html.includes("role preview"));
});
