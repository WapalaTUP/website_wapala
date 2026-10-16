import "server-only";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { getDb } from "../db";
import { getConfig } from "../config";
import { DomainError } from "../errors";
import { hmacToken } from "../security/tokens";
import { mediaRoot, mediaPath } from "./paths";
import { sanitizeImage } from "./validation";
import { scanMedia } from "./scanner";
import { mediaSlot } from "./storage";
export const publicUploadPurposeSchema = z.enum(["applicant-photo", "donation-proof"]);
type Purpose = z.infer<typeof publicUploadPurposeSchema>;
export const publicUploadOwner = (purpose: Purpose, scope: string, owner: string) => hmacToken("public-upload:" + [purpose, scope, owner].join(":"), getConfig().securityKey);
export async function registerPublicUpload(input: { purpose: Purpose; scope: string; owner: string; bytes: Buffer; mime: string }) {
  publicUploadPurposeSchema.parse(input.purpose);
  if (input.purpose === "applicant-photo") {
    const year = z.coerce.number().int().min(2004).max(2200).parse(input.scope);
    if (String(year) !== input.scope || !(await getDb().recruitmentPeriod.findUnique({ where: { year } }))?.active) throw new DomainError("PERIOD_CLOSED", 409);
  } else {
    z.uuid().parse(input.scope);
    const campaign = await getDb().campaign.findUnique({ where: { id: input.scope } });
    const today = new Date(new Date().toISOString().slice(0,10));
    if (!campaign || campaign.status !== "active" || (campaign.start && campaign.start > today) || (campaign.end && campaign.end < today)) throw new DomainError("CAMPAIGN_CLOSED", 409);
  }
  if (!input.bytes.length || input.bytes.length > 5 * 1024 * 1024) throw new DomainError("MEDIA_TOO_LARGE", 413, "Berkas maksimal 5 MB.");
  return mediaSlot("public", async () => {
    const result = await sanitizeImage(input.bytes, input.mime), root = mediaRoot(), id = randomUUID();
    const quarantine = join(root, "quarantine", id + ".bin"), final = mediaPath(root, id, result.extension);
    let written = false;
    try {
      await mkdir(dirname(quarantine), { recursive: true, mode: 0o700 });
      await writeFile(quarantine, input.bytes, { flag: "wx", mode: 0o600 });
      await scanMedia(quarantine);
      await mkdir(dirname(final), { recursive: true, mode: 0o700 });
      await writeFile(final, result.bytes, { flag: "wx", mode: 0o600 });
      written = true;
      await getDb().media.create({ data: {
        id, purpose: input.purpose, visibility: "private", mime: result.mime,
        extension: result.extension, checksum: createHash("sha256").update(result.bytes).digest("hex"),
        originalHash: createHash("sha256").update(input.bytes).digest("hex"), size: result.bytes.length,
        width: result.width, height: result.height, ownerDigest: publicUploadOwner(input.purpose, input.scope, input.owner), scannedAt: new Date(),
      } });
      return { id, url: "/api/media/" + id };
    } catch (e) {
      if (written) await unlink(final).catch(() => {});
      throw e;
    } finally { await unlink(quarantine).catch(() => {}); }
  });
}
