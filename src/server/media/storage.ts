import { parseMediaUrl } from "@/lib/media-url";
import { parseByteRange } from "@/lib/media-range";
import "server-only";
import { z } from "zod";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, readFile, unlink, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { dirname, join } from "node:path";
import type { Prisma } from "../../generated/prisma/client";
import { getDb } from "../db";
import { DomainError } from "../errors";
import { requirePermission, type Permission, type Principal } from "../auth/policy";
import { assertFresh, assertFreshRead } from "../auth/sessions";
import { writeAudit } from "../audit";
import type { RequestContext } from "../security/request-context";
import { mediaRoot, mediaPath } from "./paths";
import { sanitizeImage, sanitizeBook, sanitizeVideo, MAX_VIDEO_BYTES } from "./validation";
import { scanMedia } from "./scanner";
export const purposeSchema = z.enum([
  "generation-photo",
  "content",
  "content-video",
  "campaign",
  "inventory",
  "branding",
  "book",
  "donation-proof",
  "applicant-photo",
  "loan-proof",
  "member-photo",
  "event-cover",
  "event-poster",
  "event-upload",
]);
export type MediaPurpose = z.infer<typeof purposeSchema>;
const writePermissions: Record<MediaPurpose, Permission> = {
  "generation-photo": "generations:write",
  "event-cover": "events:write",
  "event-poster": "events:write",
  "event-upload": "events:write",
  content: "articles:submit",
  "content-video": "articles:submit",
  campaign: "campaigns:write",
  inventory: "inventory:write",
  branding: "settings:write",
  book: "content:write",
  "donation-proof": "campaigns:write",
  "applicant-photo": "recruitment:write",
  "loan-proof": "loans:write",
  "member-photo": "members:write",
};
const readPermissions: Record<MediaPurpose, Permission> = {
  ...writePermissions,
  "applicant-photo": "recruitment:read",
  "member-photo": "members:read",
};
const publicPurposes = new Set<MediaPurpose>([
  "generation-photo",
  "event-cover",
  "event-poster",
  "content",
  "content-video",
  "campaign",
  "inventory",
  "branding",
]);
export const mediaWritePermission = (purpose: MediaPurpose) => writePermissions[purpose];
type StorageOptions = {
  root?: string;
  scan?: (path: string) => Promise<number>;
};
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
// Semaphore per kelas pengunggah: publik dan admin tidak saling
// memblokir. Pola antrean sama dengan security/password.ts.
export type MediaSlotKind = "admin" | "public";
const slotLimit: Record<MediaSlotKind, number> = { admin: 2, public: 1 };
const slotQueueMax: Record<MediaSlotKind, number> = { admin: 8, public: 4 };
const slotActive: Record<MediaSlotKind, number> = { admin: 0, public: 0 };
const slotWaiters: Record<MediaSlotKind, Array<() => void>> = {
  admin: [],
  public: [],
};
export async function mediaSlot<T>(kind: MediaSlotKind, fn: () => Promise<T>): Promise<T> {
  if (slotActive[kind] >= slotLimit[kind]) {
    if (slotWaiters[kind].length >= slotQueueMax[kind])
      throw new DomainError(
        "MEDIA_BUSY",
        429,
        "Ada berkas yang sedang diperiksa. Coba beberapa saat lagi.",
      );
    await new Promise<void>((resolve) => slotWaiters[kind].push(resolve));
  } else slotActive[kind]++;
  try {
    return await fn();
  } finally {
    const next = slotWaiters[kind].shift();
    if (next) next();
    else slotActive[kind]--;
  }
}
export async function registerMedia(
  principal: Principal,
  input: { bytes: Buffer; mime: string; purpose: MediaPurpose },
  ctx: RequestContext,
  options: StorageOptions = {},
) {
  const purpose = purposeSchema.parse(input.purpose),
    permission = writePermissions[purpose];
  requirePermission(principal, permission);
  return mediaSlot("admin", async () => {
    const limit =
      purpose === "book" || purpose === "content-video" ? MAX_VIDEO_BYTES : 5 * 1024 * 1024;
    if (!input.bytes.length || input.bytes.length > limit)
      throw new DomainError("MEDIA_TOO_LARGE", 413);
    const root = options.root || mediaRoot(),
      id = randomUUID(),
      quarantine = join(root, "quarantine", id + ".bin");
    await mkdir(dirname(quarantine), { recursive: true, mode: 0o700 });
    let written = false;
    let finalPath: string | undefined;
    try {
      // Pindai berkas MENTAH di karantina sebelum di-decode:
      // payload jahat tidak pernah diproses sharp/pdfjs terlebih dahulu.
      await writeFile(quarantine, input.bytes, { flag: "wx", mode: 0o600 });
      await scanMedia(quarantine, options.scan);
      const result =
        purpose === "content-video"
          ? await sanitizeVideo(input.bytes, input.mime)
          : purpose === "book"
            ? await sanitizeBook(input.bytes, input.mime)
            : await sanitizeImage(input.bytes, input.mime);
      const final = mediaPath(root, id, result.extension);
      finalPath = final;
      await mkdir(dirname(final), { recursive: true, mode: 0o700 });
      await writeFile(final, result.bytes, { flag: "wx", mode: 0o600 });
      written = true;
      await getDb().$transaction(async (tx) => {
        await assertFresh(tx, principal, permission);
        await tx.media.create({
          data: {
            id,
            purpose,
            visibility: publicPurposes.has(purpose) ? "public" : "private",
            mime: result.mime,
            extension: result.extension,
            checksum: hash(result.bytes),
            originalHash: hash(input.bytes),
            size: result.bytes.length,
            width: result.width,
            height: result.height,
            ownerId: principal.userId,
            scannedAt: new Date(),
          },
        });
        await writeAudit(tx, {
          actorType: "USER",
          actorId: principal.userId,
          action: "MEDIA_REGISTERED",
          entityId: id,
          summary: { purpose, bytes: result.bytes.length },
          context: ctx,
        });
      });
      return {
        id,
        url: "/api/media/" + id,
        width: result.width,
        height: result.height,
      };
    } catch (e) {
      if (written && finalPath) await unlink(finalPath).catch(() => {});
      throw e;
    } finally {
      await unlink(quarantine).catch(() => {});
    }
  });
}
type MediaMeta = {
  id: string;
  mime: string;
  extension: string;
  checksum: string;
  visibility: string;
  width: number | null;
  height: number | null;
};
// Resolusi otorisasi + metadata tanpa memuat isi berkas.
async function readMediaMeta(
  id: string,
  principal: Principal | null,
  options: Pick<StorageOptions, "root"> = {},
): Promise<{ media: MediaMeta; path: string }> {
  z.uuid().parse(id);
  const media = await getDb().$transaction(async (tx) => {
    const row = await tx.media.findUnique({ where: { id } });
    if (!row) throw new DomainError("NOT_FOUND", 404);
    if (row.visibility !== "public") {
      if (!principal) throw new DomainError("NOT_FOUND", 404);
      const permission = readPermissions[purposeSchema.parse(row.purpose)];
      await assertFreshRead(tx, principal, permission);
    }
    return row;
  });
  const path = mediaPath(
    options.root || mediaRoot(),
    media.id,
    media.extension as "webp" | "pdf" | "epub" | "mp4" | "mov" | "webm" | "mkv",
  );
  await stat(path).catch(() => {
    throw new DomainError("MEDIA_CORRUPT", 503);
  });
  return { media: media as unknown as MediaMeta, path };
}
// Serving HTTP: stream, tanpa memuat seluruh berkas ke memori.
export async function readMediaStream(
  id: string,
  principal: Principal | null,
  options: Pick<StorageOptions, "root"> & { range?: string | null; ifRange?: string | null } = {},
) {
  const { media, path } = await readMediaMeta(id, principal, options);
  const size = (await stat(path)).size;
  const requested =
    options.range && (!options.ifRange || options.ifRange === '"' + media.checksum + '"');
  const range = requested ? parseByteRange(options.range!, size) : undefined;
  const stream =
    range === null
      ? null
      : (Readable.toWeb(
          createReadStream(path, range || undefined),
        ) as unknown as ReadableStream<Uint8Array>);
  return {
    stream,
    size,
    range,
    mime: media.mime,
    checksum: media.checksum,
    visibility: media.visibility,
  };
}
// Untuk export/invoice: byte penuh dengan verifikasi checksum.
export async function readMedia(
  id: string,
  principal: Principal | null,
  options: Pick<StorageOptions, "root"> = {},
) {
  const { media, path } = await readMediaMeta(id, principal, options);
  const bytes = await readFile(path);
  if (hash(bytes) !== media.checksum) throw new DomainError("MEDIA_CORRUPT", 503);
  return {
    bytes,
    mime: media.mime,
    width: media.width,
    height: media.height,
    checksum: media.checksum,
    visibility: media.visibility,
  };
}
export async function assertMediaReferences(
  tx: Prisma.TransactionClient,
  urls: string[],
  purposes: MediaPurpose[],
  visibility: "public" | "private",
) {
  for (const url of [...new Set(urls.filter(Boolean))]) {
    const id = parseMediaUrl(url);
    if (!id) throw new DomainError("INVALID_MEDIA", 400);
    const media = await tx.media.findUnique({ where: { id } });
    if (
      !media ||
      media.visibility !== visibility ||
      !purposes.includes(media.purpose as MediaPurpose)
    )
      throw new DomainError(
        "INVALID_MEDIA",
        400,
        "Pilih berkas terdaftar dengan akses yang sesuai.",
      );
  }
}
