import "server-only";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { Prisma } from "../../generated/prisma/client";
import {
  validateEventAnswers,
  type EventAnswers,
  type EventIssue,
} from "../../lib/event-form";
import {
  eventDraftSchema,
  type EventRegistrationDto,
} from "../../lib/event-types";
import { getDb } from "../db";
import { DomainError } from "../errors";
import { requirePermission, type Principal } from "../auth/policy";
import { assertFresh } from "../auth/sessions";
import { writeAudit } from "../audit";
import type { RequestContext } from "../security/request-context";
import { digestToken } from "../security/tokens";
import { acceptsEvent, asJson } from "./events";
import { eventUploadOwner } from "../media/event-upload";
export class EventAnswerError extends DomainError {
  constructor(public readonly questions: EventIssue[]) {
    super("EVENT_ANSWERS_INVALID", 400, "Periksa jawaban yang ditandai.");
  }
}
export const registrationSchema = z
  .object({
    eventId: z.uuid(),
    revisionId: z.uuid(),
    idempotencyKey: z.uuid(),
    answers: z.record(z.uuid(), z.unknown()),
  })
  .strict();
export const responseFilterSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    revisionId: z.union([z.literal(""), z.uuid()]).default(""),
    from: z.union([z.literal(""), z.iso.date()]).default(""),
    to: z.union([z.literal(""), z.iso.date()]).default(""),
    query: z.string().trim().max(200).default(""),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.from && v.to && v.from > v.to)
      c.addIssue({
        code: "custom",
        path: ["to"],
        message: "Rentang tanggal tidak valid.",
      });
  });
export type EventResponseFilter = z.input<typeof responseFilterSchema>;
const stable = (value: unknown): string =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
export async function submitEventRegistration(
  input: unknown,
  ownerDigest: string,
  ctx: RequestContext,
  beforeCreate?: () => Promise<void>,
) {
  const v = registrationSchema.parse(input),
    payloadDigest = digestToken(stable(v));
  return getDb().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id=${v.eventId}::uuid FOR UPDATE`;
    const e = await tx.event.findUnique({ where: { id: v.eventId } });
    if (!e) throw new DomainError("NOT_FOUND", 404);
    const previous = await tx.eventRegistration.findUnique({
      where: {
        eventId_idempotencyKey: {
          eventId: v.eventId,
          idempotencyKey: v.idempotencyKey,
        },
      },
    });
    if (previous) {
      if (
        previous.ownerDigest !== ownerDigest ||
        previous.payloadDigest !== payloadDigest
      )
        throw new DomainError(
          "REPLAY_CONFLICT",
          409,
          "Permintaan ini sudah digunakan untuk jawaban berbeda.",
        );
      return { code: previous.code };
    }
    if (
      await tx.eventReplayFence.findUnique({
        where: {
          eventId_idempotencyKey: {
            eventId: v.eventId,
            idempotencyKey: v.idempotencyKey,
          },
        },
      })
    )
      throw new DomainError(
        "ATTEMPT_CLOSED",
        409,
        "Percobaan ini sudah direkonsiliasi. Muat formulir baru untuk mendaftar.",
      );
    if (e.publishedRevisionId !== v.revisionId)
      throw new DomainError(
        "FORM_CHANGED",
        409,
        "Formulir diperbarui. Tinjau pertanyaan terbaru sebelum mengirim.",
      );
    const revision = await tx.eventFormRevision.findUnique({
      where: { id: v.revisionId },
    });
    if (!revision || revision.eventId !== e.id)
      throw new DomainError("NOT_FOUND", 404);
    const draft = eventDraftSchema.parse(revision.snapshot),
      count = await tx.eventRegistration.count({ where: { eventId: e.id } });
    if (!acceptsEvent(e.status, draft, count))
      throw new DomainError(
        "EVENT_CLOSED",
        409,
        "Pendaftaran ditutup, belum dimulai, atau kuota telah penuh.",
      );
    const result = validateEventAnswers(draft.form, v.answers);
    if (result.issues.length) throw new EventAnswerError(result.issues);
    // Existing receipts may replay without reusing a consumed challenge.
    if (beforeCreate) await beforeCreate();
    const id = randomUUID();
    const files = draft.form.items
      .filter((q) => q.kind === "upload" && result.answers[q.id])
      .map((q) => ({ id: String(result.answers[q.id]), questionId: q.id }));
    if (new Set(files.map((f) => f.id)).size !== files.length)
      throw new DomainError(
        "INVALID_MEDIA",
        400,
        "Gunakan berkas berbeda untuk setiap pertanyaan.",
      );
    for (const file of files.sort((a, b) => a.id.localeCompare(b.id))) {
      await tx.$queryRaw`SELECT id FROM "Media" WHERE id=${file.id}::uuid FOR UPDATE`;
      const m = await tx.media.findUnique({ where: { id: file.id } });
      if (
        !m ||
        m.purpose !== "event-upload" ||
        m.visibility !== "private" ||
        m.ownerDigest !==
          eventUploadOwner(e.id, revision.id, file.questionId, ownerDigest) ||
        m.boundTo ||
        Date.now() - m.createdAt.getTime() > 86400000
      )
        throw new DomainError(
          "INVALID_MEDIA",
          400,
          "Berkas tidak terdaftar untuk sesi pendaftaran ini.",
        );
      await tx.media.update({ where: { id: file.id }, data: { boundTo: id } });
    }
    const r = await tx.eventRegistration.create({
      data: {
        id,
        code:
          "EVT-" + randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase(),
        eventId: e.id,
        revisionId: revision.id,
        idempotencyKey: v.idempotencyKey,
        ownerDigest,
        payloadDigest,
        answers: asJson(result.answers),
      },
    });
    await writeAudit(tx, {
      actorType: "ANONYMOUS",
      action: "EVENT_REGISTERED",
      entityId: r.id,
      summary: { eventId: e.id, revision: revision.number },
      context: ctx,
    });
    return { code: r.code };
  }, { timeout: 20000 });
}
export async function reconcileEventRegistration(
  input: unknown,
  ownerDigest: string,
) {
  const v = registrationSchema.parse(input),
    payloadDigest = digestToken(stable(v));
  return getDb().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id=${v.eventId}::uuid FOR UPDATE`;
    const event = await tx.event.findUnique({ where: { id: v.eventId } });
    if (!event) throw new DomainError("NOT_FOUND", 404);
    const key = { eventId: v.eventId, idempotencyKey: v.idempotencyKey };
    const old = await tx.eventRegistration.findUnique({
      where: { eventId_idempotencyKey: key },
    });
    if (old) {
      if (
        old.ownerDigest !== ownerDigest ||
        old.payloadDigest !== payloadDigest
      )
        throw new DomainError("REPLAY_CONFLICT", 409);
      return { code: old.code };
    }
    const fence = await tx.eventReplayFence.findUnique({
      where: { eventId_idempotencyKey: key },
    });
    if (
      fence &&
      (fence.ownerDigest !== ownerDigest ||
        fence.payloadDigest !== payloadDigest)
    )
      throw new DomainError("REPLAY_CONFLICT", 409);
    if (!fence)
      await tx.eventReplayFence.create({
        data: { ...key, ownerDigest, payloadDigest },
      });
    return { code: null };
  });
}
export async function registrationWhere(
  tx: Prisma.TransactionClient,
  eventId: string,
  filter: ReturnType<typeof responseFilterSchema.parse>,
): Promise<Prisma.EventRegistrationWhereInput> {
  let hits: string[] | undefined;
  if (filter.query) {
    const query = "%" + filter.query.replace(/[\\%_]/g, "\\$&") + "%";
    const matching = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM "EventRegistration" WHERE "eventId"=${eventId}::uuid AND (code ILIKE ${query} OR answers::text ILIKE ${query}) LIMIT 10001`;
    if (matching.length > 10000)
      throw new DomainError(
        "FILTER_LIMIT",
        413,
        "Pencarian terlalu luas. Gunakan kata yang lebih spesifik.",
      );
    hits = matching.map((r) => r.id);
  }
  return {
    eventId,
    ...(filter.revisionId ? { revisionId: filter.revisionId } : {}),
    ...(filter.from || filter.to
      ? {
          createdAt: {
            ...(filter.from
              ? { gte: new Date(filter.from + "T00:00:00+07:00") }
              : {}),
            ...(filter.to
              ? {
                  lt: new Date(
                    new Date(filter.to + "T00:00:00+07:00").getTime() +
                      86400000,
                  ),
                }
              : {}),
          },
        }
      : {}),
    ...(hits ? { id: { in: hits } } : {}),
  };
}
export const registrationDto = (r: {
  id: string;
  code: string;
  createdAt: Date;
  revisionId: string;
  answers: Prisma.JsonValue;
  revision: { number: number; snapshot: Prisma.JsonValue };
}): EventRegistrationDto => ({
  id: r.id,
  code: r.code,
  createdAt: r.createdAt.toISOString(),
  revisionId: r.revisionId,
  revisionNumber: r.revision.number,
  answers: r.answers as EventAnswers,
  form: eventDraftSchema.parse(r.revision.snapshot).form,
});
export async function listEventRegistrations(
  p: Principal,
  eventId: string,
  input: EventResponseFilter,
) {
  requirePermission(p, "events:write");
  z.uuid().parse(eventId);
  const filter = responseFilterSchema.parse(input);
  return getDb().$transaction(async (tx) => {
    await assertFresh(tx, p, "events:write");
    const where = await registrationWhere(tx, eventId, filter);
    const [rows, total, revisions] = await Promise.all([
      tx.eventRegistration.findMany({
        where,
        include: { revision: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (filter.page - 1) * 50,
        take: 50,
      }),
      tx.eventRegistration.count({ where }),
      tx.eventFormRevision.findMany({
        where: { eventId },
        select: { id: true, number: true },
        orderBy: { number: "desc" },
      }),
    ]);
    return {
      rows: rows.map(registrationDto),
      total,
      page: filter.page,
      revisions,
    };
  });
}
