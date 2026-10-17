export function parseByteRange(value: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2]) || size <= 0) return null;
  const first = match[1] ? Number(match[1]) : null;
  const last = match[2] ? Number(match[2]) : null;
  if (
    (first !== null && !Number.isSafeInteger(first)) ||
    (last !== null && !Number.isSafeInteger(last))
  )
    return null;
  const start = first === null ? Math.max(0, size - (last || 0)) : first;
  const end = first === null || last === null ? size - 1 : Math.min(last, size - 1);
  return start < size && start >= 0 && end >= start ? { start, end } : null;
}
