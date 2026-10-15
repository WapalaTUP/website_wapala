import type { RecordRow } from "../../src/lib/types";
// Synthetic media paths and ordering; no imported organization album records.
export const galleryRecords: RecordRow[] = [
  ["source-a", "Category A", "2026-10-12", 6],
  ["source-b", "Category B", "2026-10-11", 4],
  ["source-c", "Category C", "2026-01-03", 1],
  ["source-d", "Category D", "2026-01-02", 1],
  ["source-e", "Category E", "2026-01-01", 1],
].map(([id, category, day, count]) => {
  const images = Array.from(
    { length: Number(count) },
    (_, index) => `/fixture/${id}-${index}.png`,
  );
  return {
    id: String(id),
    fields: {
      judul: `Synthetic ${id}`,
      kategori: String(category),
      sampul: images[0],
      gambar: JSON.stringify(images),
      tanggal_upload: String(day),
    },
  };
});
