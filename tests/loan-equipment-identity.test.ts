import { test } from "node:test";
import assert from "node:assert/strict";
import { snapshotLoanItems, loanItemsForHistory } from "../src/server/domains/loan-history-items";
import { equipmentDisplayName } from "../src/lib/equipment-identity";

const item = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  equipmentId: "550e8400-e29b-41d4-a716-446655440001",
  equipment: { code: "CB-NEW", name: "Carabiner", typeColor: "Screw" },
  equipmentSnapshot: { code: "CB-001", name: "Carabiner", typeColor: "Autolock" },
  requested: 2,
  approved: 1,
  reason: "",
  outCondition: "Baik",
  returnCondition: "",
};
test("loan history keeps the requested equipment variant when the inventory master changes", () => {
  const [history] = loanItemsForHistory({ items: [item] });
  assert.equal(history.code, "CB-001");
  assert.equal(history.name, "Carabiner — Autolock");
  assert.equal(history.requested, 2);
  assert.equal(history.approved, 1);
});
test("archiving and removing inventory keeps variant and code available for invoices", () => {
  const archivedItems = snapshotLoanItems([item]);
  const [history] = loanItemsForHistory({ items: [], archivedItems });
  assert.equal(history.name, "Carabiner — Autolock");
  assert.equal(history.code, "CB-001");
  assert.equal(history.equipmentDeleted, true);
});
test("legacy requests fall back to existing inventory identity without inventing a variant", () => {
  assert.equal(
    loanItemsForHistory({ items: [{ ...item, equipmentSnapshot: {} }] })[0].name,
    "Carabiner — Screw",
  );
  assert.equal(
    loanItemsForHistory({
      items: [
        { ...item, equipmentSnapshot: undefined, equipment: { code: "OLD", name: "Runner" } },
      ],
    })[0].name,
    "Runner",
  );
  assert.equal(equipmentDisplayName({ name: "Runner", typeColor: "  " }), "Runner");
});

test("inventory import prepares each equipment variant as immediately available", async () => {
  const { prepareBackendImport } = await import("../src/lib/backend-import");
  const headers = [
    "code",
    "name",
    "category",
    "total",
    "fit",
    "condition",
    "location",
    "typeColor",
  ];
  const result = prepareBackendImport(
    "inventaris",
    {
      headers,
      rows: [["CB-001", "Carabiner", "Panjat Tebing", "5", "5", "Baik", "Gudang", "Screw"]],
    },
    Object.fromEntries(headers.map((key) => [key, key])),
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0].available, true);
  assert.equal(result.rows[0].typeColor, "Screw");
  assert.equal(result.rows[0].maxQuantity, 5);
});
