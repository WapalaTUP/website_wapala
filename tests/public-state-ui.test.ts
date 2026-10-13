import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyState } from "../src/lib/empty-state";
import { CampaignPages } from "../src/components/campaign-pages";
test("server-supplied empty public state cannot fall back to local preview campaigns", async () => {
  const m = await import("../src/lib/store");
  assert.ok("DataProvider" in m, "public data provider exists");
  const html = renderToStaticMarkup(
    createElement(
      m.DataProvider,
      { state: emptyState() },
      createElement(CampaignPages, {}),
    ),
  );
  assert.ok(html.includes("Belum ada kampanye aktif"));
  assert.ok(!html.includes("Bersama merawat ruang hidup"));
});
