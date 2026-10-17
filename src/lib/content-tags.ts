export const CONTENT_TAGS = [
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
          values.filter(
            (v): v is string =>
              typeof v === "string" && CONTENT_TAGS.includes(v as (typeof CONTENT_TAGS)[number]),
          ),
        ),
      ]
    : [];
}
export function hasContentTag(fields: Record<string, unknown>, tag: string) {
  return parseContentTags(fields.tags).includes(tag);
}
