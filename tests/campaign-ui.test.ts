import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { seed } from "./fixtures/seed";
import { DonationForm } from "../src/components/forms";
import { DataProvider } from "../src/lib/store";
test("campaign detail displays multiple bank recipients and a separate donation poster", () => {
  const before = structuredClone(seed.campaigns[0]);
  try {
    Object.assign(seed.campaigns[0], {
      status: "active",
      poster: "/images/poster-test.png",
      bankAccounts: [
        {
          id: "one",
          bank: "Bank Pertama",
          number: "0000123",
          holder: "Penerima Pertama",
        },
        {
          id: "two",
          bank: "Bank Kedua",
          number: "0000456",
          holder: "Penerima Kedua",
        },
      ],
    });
    const html = renderToStaticMarkup(
      createElement(
        DataProvider,
        { state: seed },
        createElement(DonationForm, { campaignId: before.id }),
      ),
    );
    for (const text of [
      "Bank Pertama",
      "0000123",
      "Penerima Pertama",
      "Bank Kedua",
      "0000456",
      "Penerima Kedua",
      "Poster donasi",
      "poster-test.png",
    ])
      assert.ok(html.includes(text), text);
  } finally {
    seed.campaigns[0] = before;
  }
});
test("a QRIS-only campaign never says both payment methods are unavailable", () => {
  const before = structuredClone(seed.campaigns[0]);
  try {
    Object.assign(seed.campaigns[0], {
      status: "active",
      qrisImage: "/images/test-placeholder.png",
      bank: "",
      account: "",
    });
    const html = renderToStaticMarkup(
      createElement(
        DataProvider,
        { state: seed },
        createElement(DonationForm, { campaignId: before.id }),
      ),
    );
    assert.ok(html.includes("QRIS " + before.title));
    assert.ok(!html.includes("QRIS dan rekening belum disiapkan"));
  } finally {
    seed.campaigns[0] = before;
  }
});
