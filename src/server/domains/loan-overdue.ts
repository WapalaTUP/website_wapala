import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import { writeAudit } from "../audit";
export function overdueCutoff(now: Date) {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid clock");
  return new Date(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now) + "T00:00:00Z",
  );
}
export async function markOverdueLoans(now = new Date()) {
  const cutoff = overdueCutoff(now),
    requestId = randomUUID();
  return getDb().$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT id FROM "Loan" WHERE "archivedAt" IS NULL AND status IN ('borrowed','awaiting_return') AND "end"<${cutoff}::date ORDER BY "end",id LIMIT 100 FOR UPDATE SKIP LOCKED`;
      for (const row of rows) {
        await tx.loan.update({
          where: { id: row.id },
          data: { status: "late" },
        });
        await tx.loanHistory.create({
          data: {
            loanId: row.id,
            status: "late",
            note: "Otomatis: tanggal pengembalian telah lewat (WIB).",
          },
        });
        await writeAudit(tx, {
          actorType: "SERVER_OPERATOR",
          action: "LOAN_AUTOMATICALLY_LATE",
          entityId: row.id,
          summary: { day: cutoff.toISOString().slice(0, 10) },
          context: {
            ipDigest: "scheduled-worker",
            userAgent: "wapala-loan-overdue",
            requestId,
          },
        });
      }
      return { updated: rows.length, more: rows.length === 100 };
    },
    { timeout: 20000 },
  );
}
