import "server-only";
import { z } from "zod";
import { equipmentDisplayName } from "../../lib/equipment-identity";

const equipmentIdentitySchema = z.object({
  code: z.string(),
  name: z.string(),
  typeColor: z.string().default(""),
});

const historicalItem = z.object({
  equipmentId: z.uuid(),
  code: z.string(),
  name: z.string(),
  requested: z.number().int().nonnegative(),
  approved: z.number().int().nonnegative(),
  reason: z.string(),
  outCondition: z.string(),
  returnCondition: z.string(),
});
export const archivedLoanItems = z.array(historicalItem.extend({ itemId: z.uuid() }).strict());
type LiveItem = {
  id: string;
  equipmentId: string;
  equipment: { code: string; name: string; typeColor?: string };
  equipmentSnapshot?: unknown;
  requested: number;
  approved: number;
  reason: string;
  outCondition: string;
  returnCondition: string;
};
export function snapshotLoanItems(items: LiveItem[]) {
  return items.map((item) => {
    const saved = equipmentIdentitySchema.safeParse(item.equipmentSnapshot);
    const identity = saved.success ? saved.data : item.equipment;
    return {
      itemId: item.id,
      equipmentId: item.equipmentId,
      code: identity.code,
      name: equipmentDisplayName(identity),
      requested: item.requested,
      approved: item.approved,
      reason: item.reason,
      outCondition: item.outCondition,
      returnCondition: item.returnCondition,
    };
  });
}
// Preserve the stored archive format for older releases sharing this database.
// Derive deletion status in the DTO rather than adding fields to archived JSON.
export function loanItemsForHistory(row: { items: LiveItem[]; archivedItems?: unknown }) {
  return [
    ...archivedLoanItems
      .parse(row.archivedItems ?? [])
      .map((item) => ({ ...item, equipmentDeleted: true })),
    ...snapshotLoanItems(row.items).map((item) => ({ ...item, equipmentDeleted: false })),
  ].map(({ itemId: _itemId, ...item }) => {
    void _itemId;
    return item;
  });
}
