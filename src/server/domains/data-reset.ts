import "server-only";
import { dataResetSnapshot } from "./reset-snapshot";
import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client";
import { getDb } from "../db";
import { requirePermission, type Principal } from "../auth/policy";
import { assertFresh } from "../auth/sessions";
import { verifyDataResetPassword } from "../security/data-reset-password";
import { DomainError } from "../errors";
import { writeAudit } from "../audit";
import type { RequestContext } from "../security/request-context";
import { archivedLoanItems, snapshotLoanItems } from "./loan-history-items";

export const resetSelection = z
  .object({
    target: z.enum(["members", "inventory", "users", "loans"]),
    id: z.uuid().optional(),
    mode: z.enum(["archive", "delete"]),
  })
  .strict();
export const resetSchema = resetSelection
  .extend({
    snapshot: z.string().regex(/^[a-f0-9]{64}$/),
    confirmation: z.string().max(100),
    password: z.string().min(1).max(1024),
  })
  .strict();
type Selection = z.infer<typeof resetSelection>;

async function inspect(tx: Prisma.TransactionClient, v: Selection, actorId: string) {
  if ((v.target === "users" || v.target === "loans") && (!v.id || v.mode !== "delete"))
    throw new DomainError(
      "INVALID_INPUT",
      400,
      "Pengguna dan peminjaman hanya dapat dihapus satu data per tindakan.",
    );
  const where = {
    ...(v.id ? { id: v.id } : {}),
    ...(v.mode === "archive" ? { archivedAt: null } : {}),
  };
  const rows =
    v.target === "users"
      ? await tx.user.findMany({
          where,
          select: {
            id: true,
            credentialVersion: true,
            updatedAt: true,
            name: true,
            email: true,
            role: true,
            active: true,
            archivedAt: true,
          },
          orderBy: { id: "asc" },
        })
      : v.target === "loans"
        ? await tx.loan.findMany({
            where,
            select: { id: true, updatedAt: true, status: true },
            orderBy: { id: "asc" },
          })
        : v.target === "members"
          ? await tx.member.findMany({
              where,
              select: { id: true, version: true },
              orderBy: { id: "asc" },
            })
          : await tx.equipment.findMany({
              where,
              select: { id: true, version: true },
              orderBy: { id: "asc" },
            });
  if (v.id && !rows.length)
    throw new DomainError("NOT_FOUND", 404, "Data yang dipilih sudah tidak tersedia.");
  const ids = rows.map((r) => r.id);
  let blocked = 0;
  const blockReasons: string[] = [];
  const effects: string[] = [];
  let dependencies: unknown = null;
  if (v.target === "users") {
    if (v.id === actorId) {
      blocked = 1;
      blockReasons.push("Akun yang sedang Anda gunakan tidak dapat dihapus.");
    }
    const target = await tx.user.findUniqueOrThrow({ where: { id: v.id! } });
    if (
      target.role === "SUPER_USER" &&
      target.active &&
      !target.archivedAt &&
      (await tx.user.count({ where: { role: "SUPER_USER", active: true, archivedAt: null } })) <= 1
    ) {
      blocked = 1;
      blockReasons.push("Super User aktif terakhir harus dipertahankan.");
    }
  }
  if (v.target === "members" && v.mode === "delete") {
    const users = await tx.user.findMany({
      where: { memberId: { in: ids } },
      select: {
        id: true,
        role: true,
        active: true,
        archivedAt: true,
        credentialVersion: true,
        updatedAt: true,
      },
      orderBy: { id: "asc" },
    });
    const corrections = await tx.memberCorrection.findMany({
      where: { memberId: { in: ids } },
      select: { id: true, status: true },
      orderBy: { id: "asc" },
    });
    dependencies = { users, corrections };
    const activeSupers = await tx.user.count({
      where: { role: "SUPER_USER", active: true, archivedAt: null },
    });
    if (
      users.some((user) => user.id === actorId) ||
      users.filter((user) => user.role === "SUPER_USER" && user.active && !user.archivedAt)
        .length >= activeSupers
    ) {
      blocked = 1;
      blockReasons.push(
        "Profil ini terkait akun yang sedang dipakai atau Super User aktif terakhir.",
      );
    }
    effects.push(
      `${users.length} akun pengguna terkait beserta sesi/token login dan ${corrections.length} riwayat koreksi ikut dihapus.`,
    );
  }
  if (v.target === "inventory") {
    const items = await tx.loanItem.findMany({
      where: { equipmentId: { in: ids } },
      select: {
        id: true,
        loanId: true,
        requested: true,
        approved: true,
        returnCondition: true,
        loan: { select: { status: true, updatedAt: true } },
      },
      orderBy: { id: "asc" },
    });
    dependencies = items;
    if (v.mode === "delete")
      effects.push(
        `${items.length} item pada data peminjaman akan disimpan sebagai arsip dan ditandai alat telah dihapus. Data peminjam dan item lain tetap ada.`,
      );
  }
  if (v.target === "loans") {
    const items = await tx.loanItem.findMany({
      where: { loanId: v.id! },
      select: { id: true, equipmentId: true },
      orderBy: { id: "asc" },
    });
    const history = await tx.loanHistory.findMany({
      where: { loanId: v.id! },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    dependencies = { items, history };
    effects.push(
      `Data peminjaman, ${items.length} relasi alat, dan ${history.length} catatan status dihapus. Reservasi alat dilepas; master inventaris tetap ada.`,
    );
  }
  const confirmation = `${v.mode === "delete" ? "HAPUS PERMANEN" : "ARSIPKAN"} ${v.target === "members" ? "ANGGOTA" : v.target === "users" ? "PENGGUNA" : v.target === "loans" ? "PEMINJAMAN" : "INVENTARIS"}`;
  return {
    count: rows.length,
    blocked,
    blockReasons,
    effects,
    confirmation,
    snapshot: dataResetSnapshot(v, rows, blocked, dependencies),
  };
}

export async function previewDataReset(p: Principal, input: unknown) {
  requirePermission(p, "data:reset");
  const v = resetSelection.parse(input);
  return getDb().$transaction(async (tx) => {
    await assertFresh(tx, p, "data:reset");
    return inspect(tx, v, p.userId);
  });
}

export async function resetData(p: Principal, input: unknown, ctx: RequestContext) {
  requirePermission(p, "data:reset");
  const v = resetSchema.parse(input);
  const old = await getDb().user.findUniqueOrThrow({ where: { id: p.userId } });
  await verifyDataResetPassword(old, v.password);
  return getDb().$transaction(
    async (tx) => {
      // Match requestLoan/management reset: advisory lock precedes user/row locks.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('wapala:management'))::text`;
      // Serialize account deletion with creation, role edits, and last-Super-User protection.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(72615001)::text`;
      const current = await assertFresh(tx, p, "data:reset");
      if (current.passwordHash !== old.passwordHash)
        throw new DomainError("CONFLICT", 409, "Kredensial berubah. Silakan login kembali.");
      // Serialize master edits/imports and related writes while checking and executing.
      // Static identifiers only: never interpolate table names from request input.
      if (v.target === "users") {
        if (!v.id || v.mode !== "delete") throw new DomainError("INVALID_INPUT", 400);
        await tx.$queryRaw`SELECT id FROM "User" WHERE id=${v.id}::uuid FOR UPDATE`;
      } else if (v.target === "loans") {
        if (!v.id || v.mode !== "delete") throw new DomainError("INVALID_INPUT", 400);
        await tx.$executeRaw`LOCK TABLE "Loan" IN EXCLUSIVE MODE`;
        await tx.$executeRaw`LOCK TABLE "Equipment", "LoanItem", "LoanHistory" IN EXCLUSIVE MODE`;
      } else if (v.target === "members")
        await tx.$executeRaw`LOCK TABLE "Member", "MemberCorrection" IN EXCLUSIVE MODE`;
      else {
        // Loan transitions lock loan before equipment. EXCLUSIVE also excludes
        // SELECT FOR UPDATE, preventing row-lock/table-lock upgrade deadlocks.
        await tx.$executeRaw`LOCK TABLE "Loan" IN EXCLUSIVE MODE`;
        await tx.$executeRaw`LOCK TABLE "Equipment", "LoanItem" IN EXCLUSIVE MODE`;
      }
      const preview = await inspect(
        tx,
        { target: v.target, mode: v.mode, ...(v.id ? { id: v.id } : {}) },
        p.userId,
      );
      if (v.confirmation !== preview.confirmation)
        throw new DomainError(
          "CONFIRMATION_INVALID",
          400,
          "Ketik teks konfirmasi persis seperti yang ditampilkan.",
        );
      if (v.snapshot !== preview.snapshot)
        throw new DomainError(
          "CONFLICT",
          409,
          "Data berubah sejak diperiksa. Tutup dan periksa ulang sebelum reset.",
        );
      if (preview.blocked)
        throw new DomainError(
          "RESET_BLOCKED",
          409,
          preview.blockReasons.join(" ") || "Penghapusan diblokir oleh data terkait.",
        );
      const where = {
        ...(v.id ? { id: v.id } : {}),
        ...(v.mode === "archive" ? { archivedAt: null } : {}),
      };
      let affected: number;
      if (v.target === "users") {
        await tx.session.deleteMany({ where: { userId: v.id! } });
        await tx.passwordResetToken.deleteMany({ where: { userId: v.id! } });
        affected = (await tx.user.deleteMany({ where: { id: v.id! } })).count;
      } else if (v.target === "loans") {
        await tx.loanHistory.deleteMany({ where: { loanId: v.id! } });
        await tx.loanItem.deleteMany({ where: { loanId: v.id! } });
        affected = (await tx.loan.deleteMany({ where: { id: v.id! } })).count;
      } else if (v.target === "members") {
        if (v.mode === "delete") {
          const users = await tx.user.findMany({
            where: { memberId: v.id ? v.id : { not: null } },
            select: { id: true },
          });
          const userIds = users.map((user) => user.id);
          await tx.session.deleteMany({ where: { userId: { in: userIds } } });
          await tx.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } });
          await tx.user.deleteMany({ where: { id: { in: userIds } } });
          await tx.memberCorrection.deleteMany({ where: v.id ? { memberId: v.id } : {} });
        }
        affected =
          v.mode === "delete"
            ? (await tx.member.deleteMany({ where })).count
            : (
                await tx.member.updateMany({
                  where,
                  data: { archivedAt: new Date(), version: { increment: 1 } },
                })
              ).count;
      } else {
        if (v.mode === "delete") {
          // Copy selected items from every linked loan, including active loans,
          // before detaching the inventory reference in the same transaction.
          const loans = await tx.loan.findMany({
            where: { items: { some: v.id ? { equipmentId: v.id } : {} } },
            include: {
              items: {
                ...(v.id ? { where: { equipmentId: v.id } } : {}),
                include: { equipment: { select: { code: true, name: true, typeColor: true } } },
              },
            },
          });
          for (const loan of loans) {
            await tx.loan.update({
              where: { id: loan.id },
              data: {
                archivedItems: [
                  ...archivedLoanItems.parse(loan.archivedItems),
                  ...snapshotLoanItems(loan.items),
                ],
              },
            });
          }
          await tx.loanItem.deleteMany({ where: v.id ? { equipmentId: v.id } : {} });
        }
        affected =
          v.mode === "delete"
            ? (await tx.equipment.deleteMany({ where })).count
            : (
                await tx.equipment.updateMany({
                  where,
                  data: {
                    archivedAt: new Date(),
                    available: false,
                    version: { increment: 1 },
                  },
                })
              ).count;
      }
      await writeAudit(tx, {
        actorType: "USER",
        actorId: p.userId,
        action: v.id ? (v.mode === "delete" ? "ENTITY_DELETED" : "ENTITY_ARCHIVED") : "DATA_RESET",
        ...(v.id ? { entityId: v.id } : {}),
        summary: { target: v.target, mode: v.mode, affected },
        context: ctx,
      });
      return { affected };
    },
    { timeout: 15000 },
  );
}
