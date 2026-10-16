import "server-only";
import type { Prisma } from "../../generated/prisma/client";
export const reservedStatuses = ["approved", "borrowed", "awaiting_return", "late"] as const;
export async function reservedPeak(
  tx: Prisma.TransactionClient,
  equipmentId: string,
  start?: Date,
  end?: Date,
  excludingLoan?: string,
) {
  const items = await tx.loanItem.findMany({
    where: {
      equipmentId,
      approved: { gt: 0 },
      loan: {
        archivedAt: null,
        status: { in: [...reservedStatuses] },
        ...(excludingLoan ? { id: { not: excludingLoan } } : {}),
      },
    },
    include: { loan: { select: { start: true, end: true, status: true } } },
  });
  // Equipment physically out remains reserved until a verified return, regardless of promised return date.
  let held = 0;
  const events = new Map<number, number>();
  for (const item of items) {
    if (item.loan.status !== "approved") {
      held += item.approved;
      continue;
    }
    let from = item.loan.start.getTime(),
      to = item.loan.end.getTime();
    if (start) from = Math.max(from, start.getTime());
    if (end) to = Math.min(to, end.getTime());
    if (from > to) continue;
    events.set(from, (events.get(from) || 0) + item.approved);
    const after = to + 86400000;
    events.set(after, (events.get(after) || 0) - item.approved);
  }
  let current = held,
    peak = held;
  for (const [, delta] of [...events.entries()].sort((a, b) => a[0] - b[0])) {
    current += delta;
    peak = Math.max(peak, current);
  }
  return peak;
}
export async function lockEquipment(tx: Prisma.TransactionClient, ids: string[]) {
  for (const id of [...new Set(ids)].sort())
    await tx.$queryRaw`SELECT id FROM "Equipment" WHERE id=${id}::uuid FOR UPDATE`;
}
