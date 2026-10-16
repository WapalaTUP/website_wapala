import "server-only";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import { z } from "zod";
import { getDb } from "../db";
import { DomainError } from "../errors";
import { getConfig } from "../config";
import { hmacToken } from "../security/tokens";
import { verifyEventFormToken } from "../security/event-form-token";
import type { RequestContext } from "../security/request-context";
import { publicEvent } from "../domains/events";
import { mediaRoot, mediaPath } from "./paths";
import { sanitizeImage, validateBook } from "./validation";
import { scanMedia } from "./scanner";
import { mediaSlot } from "./storage";
export const eventUploadOwner = (
  eventId: string,
  revisionId: string,
  questionId: string,
  owner: string,
) =>
  hmacToken(
    "event-upload:" + [eventId, revisionId, questionId, owner].join(":"),
    getConfig().securityKey,
  );
export async function cleanupEventUploads(root = mediaRoot()) {
  return mediaSlot("admin", () =>
    getDb().$transaction(
      async (tx) => {
        const cutoff = new Date(Date.now() - 86400000);
        const rows = await tx.$queryRaw<
          Array<{ id: string; extension: "webp" | "pdf" }>
        >`SELECT id,extension FROM "Media" WHERE purpose='event-upload' AND "boundTo" IS NULL AND "createdAt" < ${cutoff} ORDER BY "createdAt" LIMIT 100 FOR UPDATE SKIP LOCKED`;
        for (const row of rows) {
          const path = mediaPath(root, row.id, row.extension);
          try {
            await unlink(path);
          } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
          }
          await tx.media.delete({ where: { id: row.id } });
        }
        return rows.length;
      },
      { timeout: 15000 },
    ),
  );
}
export async function registerEventUpload(
  input: { token: string; questionId: string; bytes: Buffer; mime: string },
  _ctx: RequestContext,
  options: { root?: string; scan?: (path: string) => Promise<number> } = {},
) {
  const t = verifyEventFormToken(input.token);
  z.uuid().parse(input.questionId);
  const event = await publicEvent(t.eventId);
  if (
    !event.accepting ||
    event.revisionId !== t.revisionId ||
    !event.form.items.some(
      (q) => q.id === input.questionId && q.kind === "upload",
    )
  )
    throw new DomainError(
      "FORM_CHANGED",
      409,
      "Formulir tidak lagi menerima berkas ini.",
    );
  if (!input.bytes.length || input.bytes.length > 5 * 1024 * 1024)
    throw new DomainError("MEDIA_TOO_LARGE", 413, "Berkas maksimal 5 MB.");
  return mediaSlot("admin", async () => {
    const result =
      input.mime === "application/pdf"
        ? validateBook(input.bytes, input.mime)
        : await sanitizeImage(input.bytes, input.mime);
    const root = options.root ?? mediaRoot(),
      id = randomUUID(),
      quarantine = join(root, "quarantine", id + ".bin"),
      final = mediaPath(root, id, result.extension);
    let written = false;
    try {
      await mkdir(dirname(quarantine), { recursive: true, mode: 0o700 });
      await writeFile(quarantine, input.bytes, { flag: "wx", mode: 0o600 });
      await scanMedia(quarantine, options.scan);
      await mkdir(dirname(final), { recursive: true, mode: 0o700 });
      await writeFile(final, result.bytes, { flag: "wx", mode: 0o600 });
      written = true;
      await getDb().media.create({
        data: {
          id,
          purpose: "event-upload",
          visibility: "private",
          mime: result.mime,
          extension: result.extension,
          checksum: createHash("sha256").update(result.bytes).digest("hex"),
          originalHash: createHash("sha256").update(input.bytes).digest("hex"),
          size: result.bytes.length,
          width: result.width,
          height: result.height,
          ownerDigest: eventUploadOwner(
            t.eventId,
            t.revisionId,
            input.questionId,
            t.ownerDigest,
          ),
          scannedAt: new Date(),
        },
      });
      return { id, name: "Berkas " + id };
    } catch (e) {
      if (written) await unlink(final).catch(() => {});
      throw e;
    } finally {
      await unlink(quarantine).catch(() => {});
    }
  });
}
