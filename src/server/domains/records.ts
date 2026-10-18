import { mediaUrlSchema } from "@/lib/media-url";
import "server-only";
import { z } from "zod";
import { Prisma } from "../../generated/prisma/client";
import { getDb } from "../db";
import { DomainError } from "../errors";
import { requirePermission, type Principal } from "../auth/policy";
import { assertFresh } from "../auth/sessions";
import { writeAudit } from "../audit";
import type { RequestContext } from "../security/request-context";
import { assertMediaReferences } from "../media/storage";
import { memberFields } from "../../lib/operational-schema";
import { editorialTransition, type EditorialAction } from "../../lib/editorial-workflow";
import { articleBlocksSchema } from "../../lib/article-content";
import { albumMediaItemsSchema } from "../../lib/album-media";
import { parseMediaUrl } from "../../lib/media-url";
import { splitContentFields, mergedContentFields } from "../../lib/content-compatibility";
import { legacyMemberFields, mergedMemberFields } from "../../lib/member-fields";
export { memberFields } from "../../lib/operational-schema";
const text = z.string().trim().max(300);
const optional = text.optional().default("");
const media = z
  .union([z.literal(""), mediaUrlSchema()])
  .optional()
  .default("");
export const memberSchema = z
  .object({
    id: z.uuid().optional(),
    version: z.number().int().positive().optional(),
    fields: memberFields,
    archived: z.boolean().optional(),
  })
  .strict();
export const memberImportSchema = z
  .object({ rows: z.array(memberFields).min(1).max(2000) })
  .strict();
export type MemberFields = z.infer<typeof memberFields>;
const conflict = (e: unknown) => {
  if (e && typeof e === "object" && "code" in e && e.code === "P2002")
    throw new DomainError("CONFLICT", 409, "Identitas sudah ada. Tidak ada baris yang diimpor.");
  throw e;
};
export async function listMembers(principal: Principal) {
  requirePermission(principal, "members:read");
  return getDb().$transaction(async (tx) => {
    await assertFresh(tx, principal, "members:read");
    const rows = await tx.member.findMany({
      orderBy: { createdAt: "desc" },
      take: 2000,
    });
    return rows.map((m) => ({
      id: m.id,
      version: m.version,
      fields: mergedMemberFields(m),
      archived: !!m.archivedAt,
    }));
  });
}
export async function importMembers(principal: Principal, input: unknown, ctx: RequestContext) {
  requirePermission(principal, "members:write");
  const rows = memberImportSchema.parse({ rows: input }).rows;
  const seen = new Set<string>(),
    nims = new Set<string>();
  for (const row of rows) {
    const key = row.nia.toLowerCase(),
      nim = row.nim.toLowerCase();
    if (seen.has(key) || (nim && nims.has(nim)))
      throw new DomainError(
        "DUPLICATE",
        409,
        "Identitas duplikat dalam berkas. Perbaiki seluruh batch.",
      );
    seen.add(key);
    if (nim) nims.add(nim);
  }
  try {
    return await getDb().$transaction(async (tx) => {
      await assertFresh(tx, principal, "members:write");
      await assertMediaReferences(
        tx,
        rows.map((row) => row.foto),
        ["member-photo"],
        "private",
      );
      await tx.member.createMany({
        data: rows.map((fields) => ({
          nia: fields.nia.toLowerCase(),
          nim: fields.nim ? fields.nim.toLowerCase() : null,
          fields: legacyMemberFields(fields),
          angkatanWapala: fields.angkatan_wapala,
        })),
      });
      await writeAudit(tx, {
        actorType: "USER",
        actorId: principal.userId,
        action: "MEMBERS_IMPORTED",
        summary: { count: rows.length },
        context: ctx,
      });
      return { imported: rows.length };
    });
  } catch (e) {
    return conflict(e);
  }
}
export async function saveMember(principal: Principal, input: unknown, ctx: RequestContext) {
  requirePermission(principal, "members:write");
  const v = memberSchema.parse(input);
  try {
    return await getDb().$transaction(async (tx) => {
      await assertFresh(tx, principal, "members:write");
      await assertMediaReferences(tx, [v.fields.foto], ["member-photo"], "private");
      if (v.id) {
        await tx.$queryRaw`SELECT id FROM "Member" WHERE id=${v.id}::uuid FOR UPDATE`;
        const old = await tx.member.findUnique({ where: { id: v.id } });
        if (!old) throw new DomainError("NOT_FOUND", 404);
        if (!v.version || old.version !== v.version) throw new DomainError("CONFLICT", 409);
      }
      const data = {
        nia: v.fields.nia.toLowerCase(),
        nim: v.fields.nim ? v.fields.nim.toLowerCase() : null,
        fields: legacyMemberFields(v.fields),
        ...(Object.hasOwn((input as { fields: object }).fields, "angkatan_wapala")
          ? { angkatanWapala: v.fields.angkatan_wapala }
          : {}),
        archivedAt: v.archived ? new Date() : null,
      };
      const row = v.id
        ? await tx.member.update({
            where: { id: v.id },
            data: { ...data, version: { increment: 1 } },
          })
        : await tx.member.create({ data });
      await writeAudit(tx, {
        actorType: "USER",
        actorId: principal.userId,
        action: "MEMBER_SAVED",
        entityId: row.id,
        summary: { archived: !!row.archivedAt },
        context: ctx,
      });
      return {
        id: row.id,
        version: row.version,
        fields: mergedMemberFields(row),
        archived: !!row.archivedAt,
      };
    });
  } catch (e) {
    return conflict(e);
  }
}
const longText = z.string().trim().max(10000).optional().default("");
const date = z
  .union([z.literal(""), z.iso.date()])
  .optional()
  .default("");
const status = z.enum(["Draft", "Publik"]).optional().default("Draft");
const tags = z.array(z.string().trim().min(1).max(60)).max(12).optional().default([]);
export const contentFields = {
  konten: z
    .object({
      judul: text.min(1),
      slug: z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .max(160),
      tipe: z.enum(["Berita", "Announcement"]),
      kategori: optional,
      penulis: optional,
      tanggal: date,
      sampul: media,
      status,
      ringkasan: longText,
      isi: z.string().trim().max(100000).optional().default(""),
      tags,
      bloki: z
        .string()
        .max(150000)
        .refine((value) => {
          if (!value) return true;
          try {
            return articleBlocksSchema.safeParse(JSON.parse(value)).success;
          } catch {
            return false;
          }
        }, "Blok artikel tidak valid.")
        .optional()
        .default(""),
      sampul_caption: optional,
      sampul_credit: optional,
    })
    .strict(),
  galeri: z
    .object({
      judul: text.min(1),
      kategori: optional,
      lokasi: optional,
      sampul: media,
      deskripsi: longText,
      tanggal: date,
      tanggal_upload: date,
      highlight: z.enum(["Ya", "Tidak"]).optional().default("Tidak"),
      status,
      gambar: z.array(media).max(500).optional().default([]),
      tags,
      media_items: z
        .string()
        .max(150000)
        .refine((value) => {
          if (!value) return true;
          try {
            return albumMediaItemsSchema.safeParse(JSON.parse(value)).success;
          } catch {
            return false;
          }
        }, "Media album tidak valid.")
        .optional()
        .default(""),
      featured_media: optional,
      sumber: z
        .union([
          z.literal(""),
          z.url().refine((value) => value.startsWith("https://www.wapalatelkomuniversity.org/")),
        ])
        .optional()
        .default(""),
      tahun_sumber: z
        .union([z.literal(""), z.string().regex(/^\d{4}$/)])
        .optional()
        .default(""),
      keterangan_foto: z.array(z.string().max(10000)).max(500).optional().default([]),
    })
    .strict(),
  buku: z
    .object({
      judul: text.min(1),
      kategori: optional,
      deskripsi: longText,
      file: media,
      status,
    })
    .strict(),
};
export const contentKind = z.enum(["konten", "galeri", "buku"]);
export const contentActionSchema = z.enum(["save", "submit", "return", "publish", "unpublish"]);
export function contentSaveSchema(kind: "konten" | "galeri" | "buku") {
  return z
    .object({
      id: z.uuid().optional(),
      version: z.number().int().positive().optional(),
      fields: contentFields[kind],
      archived: z.boolean().optional(),
      action: contentActionSchema.optional(),
      note: z.string().trim().max(3000).optional(),
    })
    .strict();
}
type Kind = z.infer<typeof contentKind>;
export async function saveContent(
  principal: Principal,
  kind: Kind,
  input: unknown,
  ctx: RequestContext,
) {
  const member = principal.role === "ANGGOTA" && kind === "konten";
  const permission = member ? "articles:submit" : "content:write";
  requirePermission(principal, permission);
  contentKind.parse(kind);
  const v = contentSaveSchema(kind).parse(input);
  if (member && v.archived) throw new DomainError("FORBIDDEN", 403);
  return getDb().$transaction(async (tx) => {
    await assertFresh(tx, principal, permission);
    if ("sampul" in v.fields)
      await assertMediaReferences(
        tx,
        [v.fields.sampul, ...("gambar" in v.fields ? v.fields.gambar : [])],
        ["content"],
        "public",
      );
    if (kind === "konten" && "bloki" in v.fields && v.fields.bloki) {
      const blocks = articleBlocksSchema.parse(JSON.parse(v.fields.bloki));
      await assertMediaReferences(
        tx,
        blocks.filter((b) => b.type === "image").map((b) => b.src || ""),
        ["content"],
        "public",
      );
      await assertMediaReferences(
        tx,
        blocks
          .filter((b) => b.type === "video" && b.src?.startsWith("/api/media/"))
          .map((b) => b.src || ""),
        ["content-video"],
        "public",
      );
    }
    if (kind === "galeri" && "media_items" in v.fields && v.fields.media_items) {
      const items = albumMediaItemsSchema.parse(JSON.parse(v.fields.media_items));
      const featured = v.fields.featured_media;
      if (featured && !items.some((item) => item.id === featured))
        throw new DomainError("INVALID_INPUT", 400, "Media unggulan tidak ditemukan di album.");
      await assertMediaReferences(
        tx,
        items
          .filter((item) => item.type === "image" && parseMediaUrl(item.src))
          .map((item) => item.src),
        ["content"],
        "public",
      );
      await assertMediaReferences(
        tx,
        items.filter((item) => item.type === "video").map((item) => item.src),
        ["content-video"],
        "public",
      );
    }
    if ("file" in v.fields) await assertMediaReferences(tx, [v.fields.file], ["book"], "private");
    let previous;
    if (v.id) {
      await tx.$queryRaw`SELECT id FROM "ContentRecord" WHERE id=${v.id}::uuid FOR UPDATE`;
      const row = await tx.contentRecord.findUnique({ where: { id: v.id } });
      if (!row || row.kind !== kind) throw new DomainError("NOT_FOUND", 404);
      if (member && row.authorId !== principal.userId) throw new DomainError("NOT_FOUND", 404);
      if (member && row.archivedAt) throw new DomainError("NOT_FOUND", 404);
      if (!v.version || row.version !== v.version) throw new DomainError("CONFLICT", 409);
      previous = row;
    }
    const action: EditorialAction =
      v.action || (member ? "save" : v.fields.status === "Publik" ? "publish" : "save");
    let workflowStatus =
      previous?.draftFields || !previous?.published
        ? previous?.workflowStatus || "draft"
        : "published";
    if (kind === "konten") {
      try {
        workflowStatus = editorialTransition(principal.role, workflowStatus, action);
      } catch (error) {
        throw new DomainError(
          "FORBIDDEN",
          403,
          error instanceof Error ? error.message : "Aksi tidak diizinkan.",
        );
      }
      if (action === "return" && !v.note?.trim())
        throw new DomainError("INVALID_INPUT", 400, "Isi catatan revisi untuk penulis.");
    }
    const fields = { ...v.fields };
    if (member && "penulis" in fields) {
      const author = await tx.user.findUniqueOrThrow({
        where: { id: principal.userId },
        select: { name: true },
      });
      fields.penulis = author.name;
      fields.tipe = "Berita";
    }
    if (kind === "konten") fields.status = workflowStatus === "published" ? "Publik" : "Draft";
    const keepPublished =
      kind === "konten" && !!previous?.published && action !== "unpublish" && !v.archived;
    const split = splitContentFields(fields);
    const data = {
      kind,
      fields: (kind === "konten" && keepPublished && action !== "publish"
        ? previous!.fields
        : split.fields) as Prisma.InputJsonValue,
      contentMeta: (kind === "konten" && keepPublished && action !== "publish"
        ? previous!.contentMeta
        : split.contentMeta) as Prisma.InputJsonValue,
      published:
        kind === "konten"
          ? workflowStatus === "published" || keepPublished
          : fields.status === "Publik",
      archivedAt: v.archived ? new Date() : null,
      ...(kind === "konten"
        ? {
            authorId: previous?.authorId || principal.userId,
            workflowStatus,
            reviewNote:
              action === "return"
                ? v.note || ""
                : action === "save"
                  ? previous?.reviewNote || ""
                  : "",
            draftFields:
              keepPublished && action !== "publish"
                ? (fields as Prisma.InputJsonValue)
                : Prisma.DbNull,
          }
        : {}),
    };
    const row = v.id
      ? await tx.contentRecord.update({
          where: { id: v.id },
          data: { ...data, version: { increment: 1 } },
        })
      : await tx.contentRecord.create({ data });
    await writeAudit(tx, {
      actorType: "USER",
      actorId: principal.userId,
      action: "CONTENT_SAVED",
      entityId: row.id,
      summary: { kind, published: row.published, action, workflowStatus },
      context: ctx,
    });
    return {
      id: row.id,
      version: row.version,
      fields: row.draftFields || mergedContentFields(row.fields, row.contentMeta),
      archived: !!row.archivedAt,
      authorId: row.authorId,
      published: row.published,
      workflowStatus: row.draftFields
        ? row.workflowStatus
        : row.published
          ? "published"
          : row.workflowStatus,
      reviewNote: row.reviewNote,
    };
  });
}
export async function listContent(principal: Principal, kind: Kind) {
  const member = principal.role === "ANGGOTA" && kind === "konten";
  const permission = member ? "articles:submit" : "content:write";
  requirePermission(principal, permission);
  contentKind.parse(kind);
  return getDb().$transaction(async (tx) => {
    await assertFresh(tx, principal, permission);
    return (
      await tx.contentRecord.findMany({
        where: { kind, ...(member ? { authorId: principal.userId, archivedAt: null } : {}) },
        orderBy: { createdAt: "desc" },
        take: 1000,
      })
    ).map((r) => ({
      id: r.id,
      version: r.version,
      fields: r.draftFields || mergedContentFields(r.fields, r.contentMeta),
      archived: !!r.archivedAt,
      authorId: r.authorId,
      published: r.published,
      workflowStatus: r.workflowStatus,
      reviewNote: r.reviewNote,
    }));
  });
}
export async function publicContent(kind: Kind) {
  contentKind.parse(kind);
  return (
    await getDb().contentRecord.findMany({
      where: { kind, published: true, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 1000,
    })
  ).map((r) => ({
    id: r.id,
    fields: mergedContentFields(r.fields, r.contentMeta) as Prisma.JsonObject,
  }));
}
