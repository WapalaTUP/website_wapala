// Kosakata bawaan saat backend/demo belum menyediakan tag terkelola.
// Tag sebenarnya dikelola admin (tabel Tag) dan dibaca dinamis.
export const DEFAULT_CONTENT_TAGS = [
  "Gunung Hutan",
  "SAR",
  "Rock Climbing",
  "Rafting",
  "Caving",
  "Konservasi",
] as const;
export function parseContentTags(value: unknown): string[] {
  let values = value;
  if (typeof values === "string") {
    try {
      values = JSON.parse(values);
    } catch {
      values = [values];
    }
  }
  return Array.isArray(values)
    ? [
        ...new Set(
          values
            .filter((v): v is string => typeof v === "string")
            .map((v) => v.trim())
            .filter((v) => v.length > 0 && v.length <= 60),
        ),
      ].slice(0, 12)
    : [];
}
export function hasContentTag(fields: Record<string, unknown>, tag: string) {
  return parseContentTags(fields.tags).includes(tag);
}
