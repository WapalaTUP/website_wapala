import "server-only";
import { z } from "zod";
import { getDb } from "../db";
import { DomainError } from "../errors";
import { requirePermission, type Principal } from "../auth/policy";
import { assertFresh } from "../auth/sessions";
import { writeAudit } from "../audit";
import type { RequestContext } from "../security/request-context";
import { reservedPeak, lockEquipment } from "./stock";
import { assertMediaReferences } from "../media/storage";
import { equipmentSchema } from "../../lib/operational-schema";
export { equipmentSchema, conditionSchema } from "../../lib/operational-schema";
function dto(e: Awaited<ReturnType<ReturnType<typeof getDb>["equipment"]["findMany"]>>[number]) {
  return {
    id: e.id,
    version: e.version,
    code: e.code,
    name: e.name,
    category: e.category,
    brand: e.brand,
    typeColor: e.typeColor,
    source: e.source,
    yearEntered: e.yearEntered,
    photo: e.photo,
    total: e.total,
    fit: e.fit,
    condition: e.condition,
    location: e.location,
    available: e.available,
    maxDays: e.maxDays,
    maxQuantity: e.maxQuantity,
    notes: e.notes,
    archived: !!e.archivedAt,
  };
}
export async function saveEquipment(principal: Principal, input: unknown, ctx: RequestContext) {
  requirePermission(principal, "inventory:write");
  const v = equipmentSchema.parse(input);
  try {
    return await getDb().$transaction(async (tx) => {
      await assertFresh(tx, principal, "inventory:write");
      await assertMediaReferences(tx, [v.photo], ["inventory"], "public");
      if (v.id) {
        await lockEquipment(tx, [v.id]);
        const old = await tx.equipment.findUnique({ where: { id: v.id } });
        if (!old) throw new DomainError("NOT_FOUND", 404);
        if (!v.version || old.version !== v.version) throw new DomainError("CONFLICT", 409);
        const reserved = await reservedPeak(tx, v.id);
        if (v.fit < reserved || (v.archived && reserved > 0))
          throw new DomainError(
            "STOCK_RESERVED",
            409,
            "Alat masih terikat peminjaman. Selesaikan kewajiban terlebih dahulu.",
          );
      }
      const { id, version: _version, archived, ...fields } = v;
      void _version;
      const data = {
        ...fields,
        code: fields.code.toUpperCase(),
        archivedAt: archived ? new Date() : null,
      };
      const row = id
        ? await tx.equipment.update({
            where: { id },
            data: { ...data, version: { increment: 1 } },
          })
        : await tx.equipment.create({ data });
      await writeAudit(tx, {
        actorType: "USER",
        actorId: principal.userId,
        action: "EQUIPMENT_SAVED",
        entityId: row.id,
        summary: { archived: !!row.archivedAt },
        context: ctx,
      });
      return dto(row);
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002")
      throw new DomainError("CONFLICT", 409, "Kode alat sudah digunakan.");
    throw e;
  }
}
export const equipmentAvailabilitySchema = z
  .object({
    id: z.uuid(),
    version: z.number().int().positive(),
    available: z.boolean(),
  })
  .strict();

export async function setEquipmentAvailability(
  principal: Principal,
  input: unknown,
  ctx: RequestContext,
) {
  requirePermission(principal, "inventory:write");
  const v = equipmentAvailabilitySchema.parse(input);
  return getDb().$transaction(async (tx) => {
    await assertFresh(tx, principal, "inventory:write");
    await lockEquipment(tx, [v.id]);
    const old = await tx.equipment.findUnique({ where: { id: v.id } });
    if (!old) throw new DomainError("NOT_FOUND", 404);
    if (old.version !== v.version) throw new DomainError("CONFLICT", 409);
    if (old.archivedAt)
      throw new DomainError(
        "CONFLICT",
        409,
        "Alat yang diarsipkan tidak dapat diubah ketersediaannya.",
      );
    const row = await tx.equipment.update({
      where: { id: v.id },
      data: { available: v.available, version: { increment: 1 } },
    });
    await writeAudit(tx, {
      actorType: "USER",
      actorId: principal.userId,
      action: "EQUIPMENT_AVAILABILITY_CHANGED",
      entityId: row.id,
      summary: { before: old.available, available: row.available },
      context: ctx,
    });
    return dto(row);
  });
}

export async function listEquipment(principal: Principal) {
  requirePermission(principal, "inventory:write");
  return getDb().$transaction(async (tx) => {
    await assertFresh(tx, principal, "inventory:write");
    return (await tx.equipment.findMany({ orderBy: { code: "asc" }, take: 2000 })).map(dto);
  });
}
export async function publicEquipment() {
  return getDb().equipment.findMany({
    where: { available: true, archivedAt: null },
    select: {
      id: true,
      name: true,
      category: true,
      photo: true,
      maxDays: true,
      maxQuantity: true,
    },
    orderBy: { name: "asc" },
    take: 500,
  });
}
export const equipmentImportSchema = z
  .object({ rows: z.array(equipmentSchema).min(1).max(2000) })
  .strict();
export async function importEquipment(principal: Principal, input: unknown, ctx: RequestContext) {
  requirePermission(principal, "inventory:write");
  const rows = equipmentImportSchema.parse({ rows: input }).rows;
  const seen = new Set<string>();
  for (const row of rows) {
    const code = row.code.toUpperCase();
    if (row.id || row.version || row.archived || seen.has(code))
      throw new DomainError(
        "INVALID_IMPORT",
        409,
        "Impor hanya menambah alat baru dengan kode unik.",
      );
    seen.add(code);
  }
  try {
    return await getDb().$transaction(async (tx) => {
      await assertFresh(tx, principal, "inventory:write");
      await assertMediaReferences(
        tx,
        rows.map((row) => row.photo),
        ["inventory"],
        "public",
      );
      await tx.equipment.createMany({
        data: rows.map(({ id: _id, version: _version, archived: _archived, ...row }) => {
          void _id;
          void _version;
          void _archived;
          return { ...row, code: row.code.toUpperCase() };
        }),
      });
      await writeAudit(tx, {
        actorType: "USER",
        actorId: principal.userId,
        action: "EQUIPMENT_IMPORTED",
        summary: { count: rows.length },
        context: ctx,
      });
      return { imported: rows.length };
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002")
      throw new DomainError("CONFLICT", 409, "Kode sudah ada. Tidak ada baris yang diimpor.");
    throw e;
  }
}
