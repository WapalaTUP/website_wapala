import "server-only";
import { z } from "zod";
import type { Prisma, Event } from "../../generated/prisma/client";
import {
  eventDraftSchema,
  type EventAdminDto,
  type EventDraft,
  type EventPublicDto,
  type EventStatus,
} from "../../lib/event-types";
import { getDb } from "../db";
import { DomainError } from "../errors";
import { requirePermission, type Principal } from "../auth/policy";
import { assertFresh } from "../auth/sessions";
import { writeAudit } from "../audit";
import type { RequestContext } from "../security/request-context";
import { assertMediaReferences } from "../media/storage";
import { rekeyChangedQuestions } from "../../lib/event-form";
export const eventSaveSchema = eventDraftSchema.safeExtend({
  id: z.uuid().optional(),
  version: z.number().int().positive().optional(),
});
export const eventActionSchema = z
  .object({
    id: z.uuid(),
    version: z.number().int().positive(),
    action: z.enum(["publish", "close", "reopen", "archive"]),
  })
  .strict();
export const asJson = (v: unknown) => v as Prisma.InputJsonValue;
export const eventAdminDto = (e: Event, count: number): EventAdminDto => ({
  id: e.id,
  version: e.version,
  status: e.status as EventStatus,
  draft: eventDraftSchema.parse(e.draft),
  publishedRevisionId: e.publishedRevisionId,
  registrationCount: count,
});
export async function listEvents(p: Principal) {
  requirePermission(p, "events:write");
  return getDb().$transaction(async (tx) => {
    await assertFresh(tx, p, "events:write");
    const rows = await tx.event.findMany({
      include: { _count: { select: { registrations: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((e) => eventAdminDto(e, e._count.registrations));
  });
}
export async function saveEvent(p: Principal, input: unknown, ctx: RequestContext) {
  requirePermission(p, "events:write");
  const v = eventSaveSchema.parse(input);
  if (v.id && !v.version) throw new DomainError("CONFLICT", 409);
  const { id, version, ...draft } = v;
  return getDb().$transaction(async (tx) => {
    await assertFresh(tx, p, "events:write");
    await assertMediaReferences(
      tx,
      [draft.cover, draft.poster],
      ["event-cover", "event-poster"],
      "public",
    );
    if (id) {
      await tx.$queryRaw`SELECT id FROM "Event" WHERE id=${id}::uuid FOR UPDATE`;
      const old = await tx.event.findUnique({ where: { id } });
      if (!old) throw new DomainError("NOT_FOUND", 404);
      if (old.version !== version)
        throw new DomainError(
          "CONFLICT",
          409,
          "Event telah berubah. Muat ulang sebelum menyimpan.",
        );
    }
    if (id) {
      const history = await tx.eventFormRevision.findMany({
        where: { eventId: id },
      });
      draft.form = rekeyChangedQuestions(
        draft.form,
        history.map((r) => eventDraftSchema.parse(r.snapshot).form),
      );
    }
    const e = id
      ? await tx.event.update({
          where: { id },
          data: { draft: asJson(draft), version: { increment: 1 } },
        })
      : await tx.event.create({ data: { draft: asJson(draft) } });
    await writeAudit(tx, {
      actorType: "USER",
      actorId: p.userId,
      action: "EVENT_DRAFT_SAVED",
      entityId: e.id,
      summary: { questions: draft.form.items.length },
      context: ctx,
    });
    return eventAdminDto(e, await tx.eventRegistration.count({ where: { eventId: e.id } }));
  });
}
export async function publishEvent(
  p: Principal,
  v: { id: string; version: number },
  ctx: RequestContext,
) {
  return actOnEvent(p, { ...v, action: "publish" }, ctx);
}
export async function actOnEvent(p: Principal, input: unknown, ctx: RequestContext) {
  requirePermission(p, "events:write");
  const v = eventActionSchema.parse(input);
  return getDb().$transaction(async (tx) => {
    await assertFresh(tx, p, "events:write");
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id=${v.id}::uuid FOR UPDATE`;
    const old = await tx.event.findUnique({ where: { id: v.id } });
    if (!old) throw new DomainError("NOT_FOUND", 404);
    if (old.version !== v.version)
      throw new DomainError(
        "CONFLICT",
        409,
        "Event telah berubah. Muat ulang sebelum melanjutkan.",
      );
    let revisionId = old.publishedRevisionId;
    const draft = eventDraftSchema.parse(old.draft);
    if (v.action === "publish") {
      await assertMediaReferences(
        tx,
        [draft.cover, draft.poster],
        ["event-cover", "event-poster"],
        "public",
      );
      const prior = await tx.eventFormRevision.findMany({
        where: { eventId: old.id },
        orderBy: { number: "desc" },
      });
      for (const rev of prior) {
        const form = eventDraftSchema.parse(rev.snapshot).form;
        for (const q of draft.form.items) {
          const previous = form.items.find((x) => x.id === q.id);
          if (
            previous &&
            (previous.kind !== q.kind ||
              JSON.stringify(previous.options) !== JSON.stringify(q.options) ||
              JSON.stringify(previous.gridRows) !== JSON.stringify(q.gridRows))
          )
            throw new DomainError(
              "QUESTION_CHANGED",
              400,
              "Tipe atau pilihan berubah. Gunakan ID pertanyaan baru agar jawaban lama terjaga.",
            );
        }
      }
      const rev = await tx.eventFormRevision.create({
        data: {
          eventId: old.id,
          number: (prior[0]?.number ?? 0) + 1,
          snapshot: asJson(draft),
          createdBy: p.userId,
        },
      });
      revisionId = rev.id;
    } else if (v.action === "reopen" && !revisionId)
      throw new DomainError("INVALID_STATE", 400, "Publikasikan formulir sebelum membuka event.");
    const status = v.action === "archive" ? "archived" : v.action === "close" ? "closed" : "active";
    const e = await tx.event.update({
      where: { id: old.id },
      data: {
        status,
        publishedRevisionId: revisionId,
        version: { increment: 1 },
      },
    });
    await writeAudit(tx, {
      actorType: "USER",
      actorId: p.userId,
      action: "EVENT_" + v.action.toUpperCase(),
      entityId: e.id,
      summary: { revisionId: revisionId ?? "", status },
      context: ctx,
    });
    return eventAdminDto(e, await tx.eventRegistration.count({ where: { eventId: e.id } }));
  });
}
export function acceptsEvent(status: string, d: EventDraft, count: number, now = new Date()) {
  return (
    status === "active" &&
    (!d.start || new Date(d.start) <= now) &&
    (!d.end || new Date(d.end) > now) &&
    (d.quota === null || count < d.quota)
  );
}
async function publicRows(id?: string) {
  if (id && !z.uuid().safeParse(id).success) throw new DomainError("NOT_FOUND", 404);
  return getDb().$transaction(async (tx) => {
    const events = await tx.event.findMany({
      where: {
        ...(id ? { id } : {}),
        status: { in: ["active", "closed"] },
        publishedRevisionId: { not: null },
      },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { registrations: true } } },
    });
    const revisions = await tx.eventFormRevision.findMany({
      where: { id: { in: events.map((e) => e.publishedRevisionId!) } },
    });
    return events.flatMap((e) => {
      const r = revisions.find((r) => r.id === e.publishedRevisionId && r.eventId === e.id);
      if (!r) return [];
      const d = eventDraftSchema.parse(r.snapshot);
      return [
        {
          ...d,
          id: e.id,
          revisionId: r.id,
          status: e.status as EventStatus,
          accepting: acceptsEvent(e.status, d, e._count.registrations),
        },
      ] satisfies EventPublicDto[];
    });
  });
}
export async function publicEvents() {
  return publicRows();
}
export async function publicEvent(id: string) {
  const e = (await publicRows(id))[0];
  if (!e) throw new DomainError("NOT_FOUND", 404, "Event tidak ditemukan.");
  return e;
}
