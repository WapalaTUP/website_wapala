import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFile } from "node:fs/promises";
import { DataProvider } from "../src/lib/store";
import { emptyState } from "../src/lib/empty-state";
import { PublicPage } from "../src/components/public-pages";

test("public privacy copy and portal route expose no preview mode", async () => {
  const html = renderToStaticMarkup(
    createElement(
      DataProvider,
      { state: emptyState() },
      createElement(PublicPage, { path: ["privasi"] }),
    ),
  );
  assert.doesNotMatch(html, /pratinjau|browser perangkat|data fiktif/i);
  assert.match(html, /Data yang diproses/);
  const portal = await readFile("src/app/wapala/page.tsx", "utf8");
  assert.doesNotMatch(portal, /components\/admin|previewMode|<Login/);
  assert.match(portal, /<PortalLogin\s*\/>/);
});

test("public fallbacks do not render a generic missing-image asset", async () => {
  const [login, pages] = await Promise.all([
    readFile("src/components/auth/portal-login.tsx", "utf8"),
    readFile("src/components/public-pages.tsx", "utf8"),
  ]);
  assert.doesNotMatch(login, /placeholder\.svg/);
  assert.match(login, /login-visual-art/);
  assert.match(pages, /divisionImageUrl/);
  assert.match(pages, /division-photo.*has-image/);
});
