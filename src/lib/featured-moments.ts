export function momentPanelCount(item?: { type: string; orientation: string }): 1 | 2 {
  return item && item.type !== "image" && item.orientation === "landscape" ? 1 : 2;
}
