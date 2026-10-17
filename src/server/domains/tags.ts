import "server-only";
import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client";
import { getDb } from "../db";
import { DomainError } from "../errors";
import { assertFresh } from "../auth/sessions";
import { requirePermission, type Principal } from "../auth/policy";
import { writeAudit } from "../audit";
import type { RequestContext } from "../security/request-context";

const nameSchema = z.string().trim().min(1).max(60);
function slugify(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "tag";
}
function parseTagsField(value: Record<string, unknown> | null | undefined): string[] {
  const raw = value?.tags;
  const list = Array.isArray(raw) ? raw : [];
  return list.filter((v): v is string => typeof v === "string");
}
function withTagField(
  fields: Record<string, unknown>,
  transform: (tags: string[]) => string[] | null,
): Record<string, unknown> | null {
  if (!Array.isArray(fields.tags)) return null;
  const next = transform(parseTagsField(fields));
  return next === null ? null : { ...fields, tags: next };
}

export async function listTagsWithUsage() {
  const db = getDb();
  const tags = await db.tag.findMany({ orderBy: { name: "asc" } });
  const usage = await db.$queryRaw<Array<{ name: string; used: bigint }>>`
    SELECT el.value AS name, COUNT(DISTINCT c.id) AS used
    FROM "ContentRecord" c
    CROSS JOIN LATERAL jsonb_array_elements_text(c."fields" -> 'tags') AS el(value)
    WHERE c."archivedAt" IS NULL
    GROUP BY el.value`;
  const counts = new Map(usage.map((row) => [row.name, Number(row.used)]));
  return tags.map((tag) => ({ ...tag, usage: counts.get(tag.name) ?? 0 }));
}

export async function createTag(principal: Principal, input: unknown, ctx: RequestContext) {
  requirePermission(principal, "content:write");
  const name = nameSchema.parse(input);
  return getDb().$transaction(async (tx) => {
    await assertFresh(tx, principal, "content:write");
    const exists = await tx.tag.findFirst({
      where: { OR: [{ name }, { slug: slugify(name) }] },
    });
    if (exists) throw new DomainError("TAG_EXISTS", 409, "Tag sudah ada.");
    const tag = await tx.tag.create({ data: { name, slug: slugify(name) } });
    await writeAudit(tx, {
      actorType: "USER",
      actorId: principal.userId,
      action: "TAG_CREATED",
      entityId: tag.id,
      summary: { name },
      context: ctx,
    });
    return { tag };
  });
}

export async function renameTag(
  principal: Principal,
  id: string,
  input: unknown,
  ctx: RequestContext,
) {
  requirePermission(principal, "content:write");
  if (!z.uuid().safeParse(id).success) throw new DomainError("INVALID_INPUT", 400);
  const name = nameSchema.parse(input);
  return getDb().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(72615001)::text`;
    await assertFresh(tx, principal, "content:write");
    const tag = await tx.tag.findUnique({ where: { id } });
    if (!tag) throw new DomainError("NOT_FOUND", 404);
    if (tag.name !== name) {
      const clash = await tx.tag.findFirst({
        where: { OR: [{ name }, { slug: slugify(name) }], id: { not: id } },
      });
      if (clash) throw new DomainError("TAG_EXISTS", 409, "Tag sudah ada.");
      await tx.tag.update({ where: { id }, data: { name, slug: slugify(name) } });
      // Sebarkan rename ke isi tag semua konten (fields + draftFields).
      const records = await tx.contentRecord.findMany({
        where: { archivedAt: null },
        select: { id: true, fields: true, draftFields: true },
      });
      for (const record of records) {
        const fields = record.fields as Record<string, unknown>;
        const draft = (record.draftFields ?? undefined) as Record<string, unknown> | null;
        const nextFields = withTagField(fields, (list) =>
          list.includes(tag.name) ? list.map((v) => (v === tag.name ? name : v)) : null,
        );
        const nextDraft = draft
          ? withTagField(draft, (list) =>
              list.includes(tag.name) ? list.map((v) => (v === tag.name ? name : v)) : null,
            )
          : null;
        if (nextFields || nextDraft)
          await tx.contentRecord.update({
            where: { id: record.id },
            data: {
              ...(nextFields ? { fields: nextFields as Prisma.InputJsonValue } : {}),
              ...(nextDraft ? { draftFields: nextDraft as Prisma.InputJsonValue } : {}),
            },
          });
      }
    }
    await writeAudit(tx, {
      actorType: "USER",
      actorId: principal.userId,
      action: "TAG_RENAMED",
      entityId: id,
      summary: { from: tag.name, to: name },
      context: ctx,
    });
    return { tag: { ...tag, name } };
  });
}

export async function deleteTag(principal: Principal, id: string, ctx: RequestContext) {
  requirePermission(principal, "content:write");
  if (!z.uuid().safeParse(id).success) throw new DomainError("INVALID_INPUT", 400);
  return getDb().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(72615001)::text`;
    await assertFresh(tx, principal, "content:write");
    const tag = await tx.tag.findUnique({ where: { id } });
    if (!tag) throw new DomainError("NOT_FOUND", 404);
    const records = await tx.contentRecord.findMany({
      where: { archivedAt: null },
      select: { id: true, fields: true, draftFields: true },
    });
    for (const record of records) {
      const fields = record.fields as Record<string, unknown>;
      const draft = (record.draftFields ?? undefined) as Record<string, unknown> | null;
      const strip = (list: string[]) => list.filter((v) => v !== tag.name);
      const nextFields = withTagField(fields, (list) =>
        list.includes(tag.name) ? strip(list) : null,
      );
      const nextDraft = draft
        ? withTagField(draft, (list) => (list.includes(tag.name) ? strip(list) : null))
        : null;
      if (nextFields || nextDraft)
        await tx.contentRecord.update({
          where: { id: record.id },
          data: {
            ...(nextFields ? { fields: nextFields as Prisma.InputJsonValue } : {}),
            ...(nextDraft ? { draftFields: nextDraft as Prisma.InputJsonValue } : {}),
          },
        });
    }
    await tx.tag.delete({ where: { id } });
    await writeAudit(tx, {
      actorType: "USER",
      actorId: principal.userId,
      action: "TAG_DELETED",
      entityId: id,
      summary: { name: tag.name },
      context: ctx,
    });
    return { deleted: true };
  });
}
