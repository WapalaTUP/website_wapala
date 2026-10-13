import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BackendInventory } from "../src/components/backend/inventory";

const item = {
  id: "12345678-1234-4234-8234-123456789012", version: 3,
  code: "00001", name: "Tenda", category: "Gunung Hutan", brand: "",
  typeColor: "", source: "", yearEntered: "", photo: "", total: 2,
  fit: 1, condition: "Baik", location: "Sekretariat", available: false,
  maxDays: 7, maxQuantity: 1, notes: "", archived: false,
};

test("inventory rows offer exactly edit, availability toggle and archive actions", () => {
  for (const available of [false, true]) {
    const html = renderToStaticMarkup(createElement(BackendInventory, {
      initialEquipment: [{ ...item, available }], csrfToken: "csrf",
    }));
    const actions = html.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0] || "";
    assert.equal((actions.match(/<button\b/g) || []).length, 3);
    assert.match(actions, />Edit<\/button>/);
    assert.match(actions, />Arsipkan<\/button>/);
    assert.match(actions, new RegExp(`aria-pressed="${available}"`));
    assert.match(actions, new RegExp(`aria-label="Ubah Tenda menjadi ${available ? "tidak tersedia" : "tersedia"}"`));
  }
});

test("availability uses a narrow versioned PATCH rather than resubmitting stock details", () => {
  const ui = readFileSync("src/components/backend/inventory.tsx", "utf8");
  assert.doesNotMatch(ui, /checked=\{draft.available\}/);
  assert.match(ui, /id: row.id,\s*version: row.version,\s*available: !row.available/);
  assert.match(ui, /"PATCH"/);
  const route = readFileSync("src/app/api/admin/inventory/route.ts", "utf8");
  assert.match(route, /export function PATCH/);
  assert.match(route, /readJson\(request, equipmentAvailabilitySchema\)/);
});

test("availability retains permission, session, optimistic concurrency and archive boundaries", () => {
  const domain = readFileSync("src/server/domains/inventory.ts", "utf8");
  const action = domain.split("export async function setEquipmentAvailability")[1]?.split("export async function listEquipment")[0] || "";
  assert.match(action, /requirePermission\(principal, "inventory:write"\)/);
  assert.match(action, /assertFresh\(tx, principal, "inventory:write"\)/);
  assert.match(action, /lockEquipment\(tx, \[v.id\]\)/);
  assert.match(action, /old.version !== v.version/);
  assert.match(action, /old.archivedAt/);
  assert.match(action, /data: \{ available: v.available, version: \{ increment: 1 \} \}/);
  assert.match(action, /EQUIPMENT_AVAILABILITY_CHANGED/);
  assert.match(domain, /v.archived && reserved > 0/);
});
