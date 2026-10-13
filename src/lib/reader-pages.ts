export function visibleBookPages(page: number, total: number, two: boolean) {
  if (total < 1) return [];
  const selected = Math.max(1, Math.min(total, Math.floor(page) || 1));
  const start = two ? selected - (selected % 2 === 0 ? 1 : 0) : selected;
  return two && start < total ? [start, start + 1] : [start];
}
export function nextBookPage(
  page: number,
  total: number,
  two: boolean,
  direction: number,
) {
  const start = visibleBookPages(page, total, two)[0] || 1;
  const candidate = Math.max(
    1,
    Math.min(total, start + direction * (two ? 2 : 1)),
  );
  return visibleBookPages(candidate, total, two)[0] || 1;
}
