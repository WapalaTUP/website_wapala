import "server-only";
import { getDb } from "../db";
import { assertFresh } from "../auth/sessions";
import { requirePermission, type Principal } from "../auth/policy";
import type { Prisma } from "../../generated/prisma/client";
import { z } from "zod";
import { DomainError } from "../errors";
import { writeAudit } from "../audit";
import type { RequestContext } from "../security/request-context";
export const archiveRestoreSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum([
      "anggota",
      "konten",
      "galeri",
      "buku",
      "inventaris",
      "peminjaman",
      "or",
      "donasi",
      "kampanye",
    ]),
    at: z.iso.datetime(),
  })
  .strict();
export function assertArchiveRestore(
  at: Date | null,
  expected: string,
  loan?: { status: string; penaltyStatus: string; collateralStatus: string },
) {
  if (!at || at.toISOString() !== expected)
    throw new DomainError("CONFLICT", 409, "Arsip telah berubah. Muat ulang daftar.");
  if (
    loan &&
    (!["returned", "rejected"].includes(loan.status) ||
      ["unpaid", "pending"].includes(loan.penaltyStatus) ||
      loan.collateralStatus === "held")
  )
    throw new DomainError(
      "ACTIVE_OBLIGATION",
      409,
      "Selesaikan kewajiban peminjaman sebelum pemulihan arsip.",
    );
}
export async function restoreArchive(principal: Principal, input: unknown, ctx: RequestContext) {
  requirePermission(principal, "users:write");
  const v = archiveRestoreSchema.parse(input);
  return getDb().$transaction(async (tx) => {
    await assertFresh(tx, principal, "users:write");
    switch (v.kind) {
      case "anggota": {
        const r = await tx.member.findUnique({ where: { id: v.id } });
        assertArchiveRestore(r?.archivedAt || null, v.at);
        const result = await tx.member.updateMany({
          where: { id: v.id, archivedAt: new Date(v.at) },
          data: { archivedAt: null, version: { increment: 1 } },
        });
        if (!result.count) throw new DomainError("CONFLICT", 409);
        break;
      }
      case "inventaris": {
        const r = await tx.equipment.findUnique({ where: { id: v.id } });
        assertArchiveRestore(r?.archivedAt || null, v.at);
        const result = await tx.equipment.updateMany({
          where: { id: v.id, archivedAt: new Date(v.at) },
          data: {
            archivedAt: null,
            available: false,
            version: { increment: 1 },
          },
        });
        if (!result.count) throw new DomainError("CONFLICT", 409);
        break;
      }
      case "konten":
      case "galeri":
      case "buku": {
        const r = await tx.contentRecord.findFirst({
          where: { id: v.id, kind: v.kind },
        });
        assertArchiveRestore(r?.archivedAt || null, v.at);
        const fields =
          r!.fields && typeof r!.fields === "object" && !Array.isArray(r!.fields) ? r!.fields : {};
        const result = await tx.contentRecord.updateMany({
          where: {
            id: v.id,
            kind: v.kind,
            archivedAt: new Date(v.at),
            version: r!.version,
          },
          data: {
            archivedAt: null,
            published: false,
            fields: { ...fields, status: "Draft" },
            version: { increment: 1 },
          },
        });
        if (!result.count) throw new DomainError("CONFLICT", 409);
        break;
      }
      case "or": {
        const r = await tx.applicant.findUnique({ where: { id: v.id } });
        assertArchiveRestore(r?.archivedAt || null, v.at);
        const result = await tx.applicant.updateMany({
          where: { id: v.id, archivedAt: new Date(v.at) },
          data: { archivedAt: null },
        });
        if (!result.count) throw new DomainError("CONFLICT", 409);
        break;
      }
      case "donasi": {
        const r = await tx.donation.findUnique({ where: { id: v.id } });
        assertArchiveRestore(r?.archivedAt || null, v.at);
        const result = await tx.donation.updateMany({
          where: { id: v.id, archivedAt: new Date(v.at) },
          data: { archivedAt: null },
        });
        if (!result.count) throw new DomainError("CONFLICT", 409);
        break;
      }
      case "peminjaman": {
        await tx.$queryRaw`SELECT id FROM "Loan" WHERE id=${v.id}::uuid FOR UPDATE`;
        const r = await tx.loan.findUnique({ where: { id: v.id } });
        assertArchiveRestore(r?.archivedAt || null, v.at, r || undefined);
        await tx.loan.update({
          where: { id: v.id },
          data: { archivedAt: null },
        });
        break;
      }
      case "kampanye": {
        const result = await tx.campaign.updateMany({
          where: { id: v.id, status: "archived", updatedAt: new Date(v.at) },
          data: { status: "draft", version: { increment: 1 } },
        });
        if (!result.count) throw new DomainError("CONFLICT", 409);
        break;
      }
    }
    await writeAudit(tx, {
      actorType: "USER",
      actorId: principal.userId,
      action: "ARCHIVE_RESTORED",
      entityId: v.id,
      summary: { kind: v.kind },
      context: ctx,
    });
    return { restored: v.id };
  });
}

const title = (fields: Prisma.JsonValue) =>
  fields && typeof fields === "object" && !Array.isArray(fields)
    ? String(fields.nama || fields.judul || "Dokumen")
    : "Dokumen";
export async function listArchives(principal: Principal, limit = 100) {
  requirePermission(principal, "users:write");
  z.number().int().min(1).max(10001).parse(limit);
  return getDb().$transaction(async (tx) => {
    await assertFresh(tx, principal, "users:write");
    const filter = {
      where: { archivedAt: { not: null } },
      orderBy: { archivedAt: "desc" as const },
      take: limit,
    };
    const [members, content, equipment, loans, applicants, donations, campaigns] =
      await Promise.all([
        tx.member.findMany({
          ...filter,
          select: { id: true, fields: true, archivedAt: true },
        }),
        tx.contentRecord.findMany({
          ...filter,
          select: { id: true, kind: true, fields: true, archivedAt: true },
        }),
        tx.equipment.findMany({
          ...filter,
          select: { id: true, name: true, archivedAt: true },
        }),
        tx.loan.findMany({
          ...filter,
          select: { id: true, code: true, archivedAt: true },
        }),
        tx.applicant.findMany({
          ...filter,
          select: { id: true, code: true, archivedAt: true },
        }),
        tx.donation.findMany({
          ...filter,
          select: { id: true, name: true, archivedAt: true },
        }),
        tx.campaign.findMany({
          where: { status: "archived" },
          orderBy: { updatedAt: "desc" },
          take: limit,
          select: { id: true, title: true, updatedAt: true },
        }),
      ]);
    return [
      ...members.map((r) => ({
        id: r.id,
        kind: "anggota",
        title: title(r.fields),
        at: r.archivedAt!.toISOString(),
      })),
      ...content.map((r) => ({
        id: r.id,
        kind: r.kind,
        title: title(r.fields),
        at: r.archivedAt!.toISOString(),
      })),
      ...equipment.map((r) => ({
        id: r.id,
        kind: "inventaris",
        title: r.name,
        at: r.archivedAt!.toISOString(),
      })),
      ...loans.map((r) => ({
        id: r.id,
        kind: "peminjaman",
        title: r.code,
        at: r.archivedAt!.toISOString(),
      })),
      ...applicants.map((r) => ({
        id: r.id,
        kind: "or",
        title: r.code,
        at: r.archivedAt!.toISOString(),
      })),
      ...donations.map((r) => ({
        id: r.id,
        kind: "donasi",
        title: r.name,
        at: r.archivedAt!.toISOString(),
      })),
      ...campaigns.map((r) => ({
        id: r.id,
        kind: "kampanye",
        title: r.title,
        at: r.updatedAt.toISOString(),
      })),
    ].sort((a, b) => b.at.localeCompare(a.at));
  });
}
