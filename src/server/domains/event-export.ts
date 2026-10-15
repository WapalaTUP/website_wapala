import "server-only";
import ExcelJS from "exceljs";
import { z } from "zod";
import { eventAnswerLabel, type EventQuestion } from "../../lib/event-form";
import {
  eventDraftSchema,
  type EventRegistrationDto,
} from "../../lib/event-types";
import { getDb } from "../db";
import { DomainError } from "../errors";
import { requirePermission, type Principal } from "../auth/policy";
import { assertFresh } from "../auth/sessions";
import {
  registrationWhere,
  responseFilterSchema,
  type EventResponseFilter,
} from "./event-registrations";
export async function exportEventWorkbook({
  title,
  rows,
}: {
  title: string;
  rows: EventRegistrationDto[];
}) {
  const questions = new Map<string, EventQuestion>();
  for (const r of [...rows].sort((a, b) => a.revisionNumber - b.revisionNumber))
    for (const q of r.form.items)
      if (q.kind !== "section" && !questions.has(q.id)) questions.set(q.id, q);
  assertEventExportBudget({
    rows: rows.length,
    answerBytes: rows.reduce(
      (total, r) => total + Buffer.byteLength(JSON.stringify(r.answers)),
      0,
    ),
    columns: questions.size + 3,
  });
  const parts = new Map([...questions.keys()].map((id) => [id, 1]));
  let displayBytes = 0;
  const prepared = rows.map((r) => {
    const values: Record<string, Array<string | number>> = {};
    for (const q of r.form.items) {
      if (q.kind === "section") continue;
      const label =
        q.kind === "upload" && r.answers[q.id]
          ? "Berkas " + String(r.answers[q.id])
          : eventAnswerLabel(q, r.answers[q.id]);
      const chunks =
        typeof label === "number" ? [label] : excelTextParts(label);
      values[q.id] = chunks;
      parts.set(q.id, Math.max(parts.get(q.id) ?? 1, chunks.length));
      displayBytes += Buffer.byteLength(String(label));
    }
    assertEventExportBudget({
      rows: rows.length,
      answerBytes: displayBytes,
      columns: 3 + [...parts.values()].reduce((a, b) => a + b, 0),
    });
    return { r, values };
  });
  const wb = new ExcelJS.Workbook();
  wb.creator = "WAPALA";
  wb.title = title;
  const sheet = wb.addWorksheet("Pendaftar", {
      views: [{ state: "frozen", ySplit: 1 }],
    }),
    dictionary = wb.addWorksheet("Kamus pertanyaan");
  sheet.columns = [
    { header: "Kode pendaftaran", key: "code", width: 24 },
    { header: "Waktu pendaftaran (WIB)", key: "time", width: 26 },
    { header: "Versi formulir", key: "version", width: 18 },
    ...[...questions.values()].flatMap((q) =>
      Array.from({ length: parts.get(q.id) ?? 1 }, (_, i) => ({
        header:
          q.title +
          " [" +
          q.id +
          "]" +
          (i ? " (lanjutan " + (i + 1) + ")" : ""),
        key: q.id + "#" + i,
        width: 32,
      })),
    ),
  ];
  dictionary.columns = [
    { header: "ID pertanyaan", key: "id", width: 40 },
    { header: "Versi formulir", key: "version", width: 18 },
    { header: "Judul saat pendaftaran", key: "title", width: 40 },
    { header: "Tipe", key: "kind", width: 20 },
    { header: "Pilihan / baris", key: "options", width: 60 },
    { header: "Bagian definisi", key: "part", width: 18 },
  ];
  const described = new Set<string>();
  for (const { r, values: answerParts } of prepared) {
    const values: Record<string, string | number> = {
      code: r.code,
      time: new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Jakarta",
        dateStyle: "short",
        timeStyle: "medium",
      }).format(new Date(r.createdAt)),
      version: r.revisionNumber,
    };
    for (const q of r.form.items) {
      if (q.kind === "section") continue;
      answerParts[q.id]?.forEach((value, i) => {
        values[q.id + "#" + i] = value;
      });
      const key = r.revisionId + ":" + q.id;
      if (!described.has(key)) {
        described.add(key);
        const definition = excelTextParts(
          [
            ...q.options.map((o) => o.id + ": " + o.label),
            ...q.gridRows.map((o) => o.id + ": " + o.label),
          ].join("; "),
        );
        definition.forEach((options, i) =>
          dictionary.addRow({
            id: q.id,
            version: r.revisionNumber,
            title: q.title,
            kind: q.kind,
            options,
            part: i + 1,
          }),
        );
      }
    }
    sheet.addRow(values);
  }
  if (dictionary.rowCount > 1048576)
    throw new DomainError(
      "EXPORT_LIMIT",
      413,
      "Definisi historis terlalu besar. Persempit filter versi.",
    );
  for (const s of [sheet, dictionary]) {
    s.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF24533F" },
    };
    s.getRow(1).alignment = { vertical: "middle", wrapText: true };
    s.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, s.rowCount), column: s.columnCount },
    };
    s.eachRow((row, i) => {
      if (i > 1) row.alignment = { vertical: "top", wrapText: true };
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
function excelTextParts(value: string) {
  const parts: string[] = [];
  let start = 0;
  while (start < value.length) {
    let end = Math.min(start + 30000, value.length);
    const code = value.charCodeAt(end - 1);
    if (end < value.length && code >= 0xd800 && code <= 0xdbff) end--;
    parts.push(value.slice(start, end));
    start = end;
  }
  return parts.length ? parts : [""];
}
export function assertEventExportBudget({
  rows,
  answerBytes,
  columns,
}: {
  rows: number;
  answerBytes: number;
  columns: number;
}) {
  if (
    rows > 10000 ||
    answerBytes > 100 * 1024 * 1024 ||
    columns > 16384 ||
    rows * columns > 200000
  )
    throw new DomainError(
      "EXPORT_LIMIT",
      413,
      "Ekspor melebihi batas baris, kolom atau memori. Persempit filter tanggal/versi; tidak ada data yang diekspor sebagian.",
    );
}
export async function loadEventExport(
  p: Principal,
  eventId: string,
  input: EventResponseFilter,
) {
  requirePermission(p, "events:write");
  z.uuid().parse(eventId);
  const f = responseFilterSchema.parse(input);
  const snapshot = await getDb().$transaction(
    async (tx) => {
      await assertFresh(tx, p, "events:write");
      const e = await tx.event.findUnique({ where: { id: eventId } });
      if (!e) throw new DomainError("NOT_FOUND", 404);
      const where = await registrationWhere(tx, eventId, f);
      const count = await tx.eventRegistration.count({ where });
      if (count > 10000)
        throw new DomainError(
          "EXPORT_LIMIT",
          413,
          "Maksimal 10.000 respons per ekspor. Persempit filter.",
        );
      const pattern = f.query
        ? "%" + f.query.replace(/[\\%_]/g, "\\$&") + "%"
        : null;
      const from = f.from ? new Date(f.from + "T00:00:00+07:00") : null,
        to = f.to
          ? new Date(new Date(f.to + "T00:00:00+07:00").getTime() + 86400000)
          : null;
      const sizes = await tx.$queryRaw<
        Array<{ bytes: bigint }>
      >`SELECT COALESCE(SUM(octet_length(answers::text)),0)::bigint AS bytes FROM "EventRegistration" WHERE "eventId"=${eventId}::uuid AND (${f.revisionId || null}::uuid IS NULL OR "revisionId"=${f.revisionId || null}::uuid) AND (${from}::timestamp IS NULL OR "createdAt">=${from}::timestamp) AND (${to}::timestamp IS NULL OR "createdAt"<${to}::timestamp) AND (${pattern}::text IS NULL OR code ILIKE ${pattern} OR answers::text ILIKE ${pattern})`;
      assertEventExportBudget({
        rows: count,
        answerBytes: Number(sizes[0].bytes),
        columns: 3,
      });
      const references = await tx.eventRegistration.groupBy({
        by: ["revisionId"],
        where,
      });
      const revisionSize = await tx.$queryRaw<
        Array<{ bytes: bigint }>
      >`SELECT COALESCE(SUM(octet_length(r.snapshot::text)),0)::bigint AS bytes FROM "EventFormRevision" r WHERE r."eventId"=${eventId}::uuid AND EXISTS (SELECT 1 FROM "EventRegistration" e WHERE e."revisionId"=r.id AND (${f.revisionId || null}::uuid IS NULL OR e."revisionId"=${f.revisionId || null}::uuid) AND (${from}::timestamp IS NULL OR e."createdAt">=${from}::timestamp) AND (${to}::timestamp IS NULL OR e."createdAt"<${to}::timestamp) AND (${pattern}::text IS NULL OR e.code ILIKE ${pattern} OR e.answers::text ILIKE ${pattern}))`;
      assertEventExportBudget({
        rows: count,
        answerBytes: Number(sizes[0].bytes) + Number(revisionSize[0].bytes),
        columns: 3,
      });
      const revisions = await tx.eventFormRevision.findMany({
        where: { id: { in: references.map((r) => r.revisionId) } },
      });
      const parsed = new Map(
        revisions.map((r) => [
          r.id,
          { ...r, form: eventDraftSchema.parse(r.snapshot).form },
        ]),
      );
      const columns =
        new Set(
          revisions.flatMap((r) =>
            parsed
              .get(r.id)!
              .form.items.filter((q) => q.kind !== "section")
              .map((q) => q.id),
          ),
        ).size + 3;
      assertEventExportBudget({
        rows: count,
        answerBytes: Number(sizes[0].bytes),
        columns,
      });
      const rows: EventRegistrationDto[] = [];
      let cursor: string | undefined;
      do {
        const batch = await tx.eventRegistration.findMany({
          where,
          orderBy: { id: "asc" },
          take: 100,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        for (const r of batch) {
          const rev = parsed.get(r.revisionId)!;
          rows.push({
            id: r.id,
            code: r.code,
            createdAt: r.createdAt.toISOString(),
            revisionId: r.revisionId,
            revisionNumber: rev.number,
            answers: r.answers as EventRegistrationDto["answers"],
            form: rev.form,
          });
        }
        if (batch.length < 100) break;
        cursor = batch.at(-1)!.id;
      } while (rows.length < count);
      return {
        title: eventDraftSchema.parse(e.draft).title,
        rows,
      };
    },
    { isolationLevel: "RepeatableRead", timeout: 20000 },
  );
  return exportEventWorkbook(snapshot);
}
