export function equipmentDisplayName(item: { name: string; typeColor?: string }) {
  return [item.name, item.typeColor?.trim()].filter(Boolean).join(" — ");
}
