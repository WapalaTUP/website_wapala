import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DataProvider } from "../src/lib/store";
import { emptyState } from "../src/lib/empty-state";
import { LoanForm } from "../src/components/forms";
import { EventPages } from "../src/components/events/event-pages";

test("Event heading renders a line break, not a literal escape sequence", () => {
  const html = renderToStaticMarkup(
    createElement(
      DataProvider,
      { state: emptyState() },
      createElement(EventPages),
    ),
  );
  assert.doesNotMatch(html, /belajar,\\nbergerak/);
  assert.match(html, /belajar,\nbergerak/);
});

test("loan selector reads the public database catalog and enforces its quantity limit", () => {
  const state = emptyState();
  state.backend = true;
  state.publicEquipment = [
    {
      id: "tool-1",
      name: "Tenda database",
      category: "Kemah",
      photo: "",
      available: true,
      maxDays: 7,
      maxQuantity: 3,
    },
    {
      id: "tool-2",
      name: "Helm tidak tersedia",
      category: "Caving",
      photo: "",
      available: false,
      maxDays: 4,
      maxQuantity: 2,
    },
  ];
  const html = renderToStaticMarkup(
    createElement(DataProvider, { state }, createElement(LoanForm)),
  );
  assert.match(html, /Tenda database/);
  assert.match(html, /id="tool-1"[^>]*max="3"/);
  assert.match(html, /id="tool-2"[^>]*disabled/);
  assert.doesNotMatch(html, /Alat tidak ditemukan/);
});
