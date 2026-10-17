export type EditorialStatus = "draft" | "submitted" | "returned" | "published";
export type EditorialAction = "save" | "submit" | "return" | "publish" | "unpublish";
export function editorialTransition(
  role: string,
  current: string,
  action: EditorialAction,
): EditorialStatus {
  const reviewer = role === "MULTIMEDIA" || role === "SUPER_USER";
  if (!reviewer && role !== "ANGGOTA") throw new Error("Akses berita tidak diizinkan.");
  if (!reviewer && (action === "publish" || action === "return" || action === "unpublish"))
    throw new Error("Hanya Multimedia yang dapat meninjau berita.");
  if (!reviewer && current === "submitted") throw new Error("Artikel sedang ditinjau Multimedia.");
  if (action === "submit") return "submitted";
  if (action === "publish") return "published";
  if (action === "return") return "returned";
  if (action === "unpublish") return "draft";
  if (reviewer && current === "submitted") return "submitted";
  if (reviewer && current === "returned") return "returned";
  return "draft";
}
