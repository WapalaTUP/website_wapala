import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";
test("long checkbox labels export complete across continuation columns without oversized Excel cells", async () => {
  const m = await import("../../src/server/domains/event-export");
  const q = {
    id: randomUUID(),
    kind: "checkbox" as const,
    title: "Pilihan",
    help: "",
    required: false,
    options: Array.from({ length: 200 }, (_, i) => ({
      id: randomUUID(),
      label: "Pilihan " + i + " " + "x".repeat(200),
    })),
    gridRows: [],
    validation: {},
    other: false,
  };
  const row = {
    id: randomUUID(),
    code: "EVT-LONG",
    createdAt: new Date().toISOString(),
    revisionId: randomUUID(),
    revisionNumber: 1,
    answers: { [q.id]: q.options.map((o) => o.id) },
    form: { title: "Uji", description: "", items: [q] },
  };
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(
    (await m.exportEventWorkbook({
      title: "Uji",
      rows: [row],
    })) as unknown as Parameters<typeof wb.xlsx.load>[0],
  );
  const sheet = wb.getWorksheet("Pendaftar")!;
  const first = String(sheet.getCell("D2").value ?? ""),
    second = String(sheet.getCell("E2").value ?? "");
  assert.ok(first.length <= 32767);
  assert.ok(second.length > 0);
  assert.equal(first + second, q.options.map((o) => o.label).join("; "));
});
test("export dimensions and bytes are rejected before constructing an Excel workbook", async () => {
  const m = await import("../../src/server/domains/event-export");
  assert.equal(
    typeof m.assertEventExportBudget,
    "function",
    "Preflight export budget exists",
  );
  assert.throws(
    () =>
      m.assertEventExportBudget({
        rows: 999,
        answerBytes: 101 * 1024 * 1024,
        columns: 10,
      }),
    { code: "EXPORT_LIMIT" },
  );
  assert.throws(
    () =>
      m.assertEventExportBudget({ rows: 82, answerBytes: 1, columns: 16403 }),
    { code: "EXPORT_LIMIT" },
  );
  assert.doesNotThrow(() =>
    m.assertEventExportBudget({ rows: 100, answerBytes: 10000, columns: 20 }),
  );
});
test("event Excel keeps leading zero identifiers formula-like strings and historical columns", async () => {
  const m = await import("../../src/server/domains/event-export").catch(
    () => null,
  );
  assert.ok(m, "Event export exists");
  const id = randomUUID();
  const q = {
    id,
    kind: "shortText" as const,
    title: "Identitas",
    help: "",
    required: false,
    options: [],
    gridRows: [],
    validation: {},
    other: false,
  };
  const q2 = { ...q, id: randomUUID() };
  const rows = [
    {
      id: randomUUID(),
      code: "EVT-1",
      createdAt: "2026-10-13T00:00:00.000Z",
      revisionId: randomUUID(),
      revisionNumber: 1,
      answers: { [q.id]: "00123", [q2.id]: '=HYPERLINK("bad")' },
      form: { title: "Uji", description: "", items: [q, q2] },
    },
  ];
  const buffer = await m.exportEventWorkbook({ title: "Event", rows });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const sheet = wb.getWorksheet("Pendaftar")!;
  assert.equal(sheet.rowCount, 2);
  assert.equal(sheet.getCell("D2").value, "00123");
  assert.equal(sheet.getCell("D2").type, ExcelJS.ValueType.String);
  assert.equal(sheet.getCell("E2").value, '=HYPERLINK("bad")');
  assert.equal(sheet.getCell("E2").type, ExcelJS.ValueType.String);
  assert.notEqual(sheet.getCell("D1").value, sheet.getCell("E1").value);
  assert.equal(wb.worksheets.length, 2);
});
