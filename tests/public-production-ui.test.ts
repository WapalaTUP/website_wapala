import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DataProvider } from "../src/lib/store";
import { emptyState } from "../src/lib/empty-state";
import { LoanTracking } from "../src/components/forms";
test("public loan tracking requires the registered phone instead of treating the short code as authority", () => {
  const html = renderToStaticMarkup(
    createElement(
      DataProvider,
      { state: emptyState() },
      createElement(LoanTracking, { initialCode: "WPL12345" }),
    ),
  );
  assert.match(html, /Nomor telepon terdaftar/);
  assert.doesNotMatch(html, /portal admin preview|Pratinjau:/);
});
