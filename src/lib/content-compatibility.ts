const extraKeys = new Set([
  "tags",
  "bloki",
  "sampul_caption",
  "sampul_credit",
  "media_items",
  "featured_media",
]);
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const marker = (fields: Record<string, unknown>) =>
  JSON.stringify([
    fields.isi || "",
    fields.gambar || [],
    fields.sampul || "",
    fields.keterangan_foto || [],
  ]);
/** Keep old main's strict JSON schemas usable after a code rollback. */
export function splitContentFields(input: Record<string, unknown>) {
  const fields: Record<string, unknown> = {},
    contentMeta: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input))
    (extraKeys.has(key) ? contentMeta : fields)[key] = value;
  if (typeof input.media_items === "string" && input.media_items.trim()) {
    try {
      const items: unknown = JSON.parse(input.media_items);
      if (Array.isArray(items)) {
        const photos = items
          .map(object)
          .filter((item) => item.type === "image" && typeof item.src === "string");
        fields.gambar = photos.map((item) => item.src);
        fields.keterangan_foto = photos.map((item) =>
          typeof item.caption === "string" ? item.caption : "",
        );
        const featured = photos.find((item) => item.id === input.featured_media) || photos[0];
        fields.sampul = featured?.src || "";
      }
    } catch {
      /* Input validation reports malformed media JSON at the boundary. */
    }
  }
  if (typeof fields.isi === "string" && fields.isi.length > 10000) {
    contentMeta.fullIsi = fields.isi;
    fields.isi = fields.isi.slice(0, 10000);
  }
  contentMeta.legacyMarker = marker(fields);
  return { fields, contentMeta };
}
export function mergedContentFields(legacy: unknown, metadata: unknown): Record<string, unknown> {
  const fields = { ...object(legacy) },
    meta = object(metadata);
  const unchanged = meta.legacyMarker === marker(fields);
  for (const [key, value] of Object.entries(meta)) {
    if (!extraKeys.has(key)) continue;
    if (
      !unchanged &&
      ["bloki", "media_items", "featured_media", "sampul_caption", "sampul_credit"].includes(key)
    )
      continue;
    fields[key] = value;
  }
  if (unchanged && typeof meta.fullIsi === "string") fields.isi = meta.fullIsi;
  return fields;
}
