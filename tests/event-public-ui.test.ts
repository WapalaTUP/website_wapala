import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { blankEvent } from "../src/lib/event-types";
test("event cards show published event descriptions and omit registration action when closed", async () => {
  const m = await import("../src/components/events/event-pages").catch(
    () => null,
  );
  assert.ok(m, "Public event pages exist");
  const event = {
    ...blankEvent(),
    id: "event",
    revisionId: "rev",
    status: "active" as const,
    accepting: true,
    title: "Camp Fire",
    description: "Kegiatan alam WAPALA",
    poster: "/api/media/image",
  };
  const html = renderToStaticMarkup(
    React.createElement(m.EventCard, { event }),
  );
  assert.match(html, /Camp Fire/);
  assert.match(html, /Kegiatan alam WAPALA/);
  assert.match(html, /Daftar/);
  const closed = renderToStaticMarkup(
    React.createElement(m.EventCard, {
      event: { ...event, status: "closed", accepting: false },
    }),
  );
  assert.doesNotMatch(closed, />Daftar/);
  assert.match(closed, /Ditutup/);
});
