import { parseMediaUrl } from "@/lib/media-url";
import "server-only";
import { z } from "zod";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { getDb } from "../db";
import { DomainError } from "../errors";
import { mediaPath, mediaRoot } from "../media/paths";
type BookRecord = {
  published: boolean;
  archivedAt: Date | null;
  fields: unknown;
};
type BookMedia = {
  id: string;
  purpose: string;
  visibility: string;
  scannedAt: Date | null;
  mime: string;
  extension: string;
  size: number;
};
export function authorizePublishedBook(record: BookRecord | null, media: BookMedia | null) {
  const fields = z
    .object({
      judul: z.string(),
      file: z.string(),
      status: z.literal("Publik"),
    })
    .safeParse(record?.fields);
  if (
    !record?.published ||
    record.archivedAt ||
    !fields.success ||
    !media ||
    fields.data.file !== "/api/media/" + media.id ||
    media.purpose !== "book" ||
    media.visibility !== "private" ||
    !media.scannedAt ||
    !(
      (media.mime === "application/pdf" && media.extension === "pdf") ||
      (media.mime === "application/epub+zip" && media.extension === "epub")
    )
  )
    throw new DomainError("NOT_FOUND", 404);
  if (media.size < 1 || media.size > 50 * 1024 * 1024)
    throw new DomainError("MEDIA_TOO_LARGE", 413);
  return { title: fields.data.judul, mime: media.mime };
}
type BookInfo = { title: string; mime: string; id: string; url: string };
export function publishedBook(id: string, file: true): Promise<BookInfo & { bytes: Buffer }>;
export function publishedBook(id: string, file?: false): Promise<BookInfo>;
export async function publishedBook(id: string, file = false) {
  z.uuid().parse(id);
  const { media, info } = await getDb().$transaction(
    async (tx) => {
      const record = await tx.contentRecord.findFirst({
        where: { id, kind: "buku", published: true, archivedAt: null },
      });
      const fields = z.object({ file: z.string() }).safeParse(record?.fields);
      const mediaId = fields.success ? parseMediaUrl(fields.data.file) : undefined;
      const media = mediaId ? await tx.media.findUnique({ where: { id: mediaId } }) : null;
      const info = authorizePublishedBook(record, media);
      return { media: media!, info };
    },
    { isolationLevel: "RepeatableRead" },
  );
  if (!file) return { ...info, id, url: "/api/books/" + id + "/file" };
  const path = mediaPath(mediaRoot(), media.id, media.extension as "pdf" | "epub");
  if ((await stat(path)).size !== media.size) throw new DomainError("MEDIA_CORRUPT", 503);
  const bytes = await readFile(path);
  if (
    bytes.length !== media.size ||
    createHash("sha256").update(bytes).digest("hex") !== media.checksum
  )
    throw new DomainError("MEDIA_CORRUPT", 503);
  return { ...info, id, url: "/api/books/" + id + "/file", bytes };
}
