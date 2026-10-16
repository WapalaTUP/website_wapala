import { mediaUrlSchema } from "@/lib/media-url";
import "server-only";
import { z } from "zod";
import { getDb } from "./db";
import { writeAudit } from "./audit";
import type { RequestContext } from "./security/request-context";
import { requirePermission, type Principal } from "./auth/policy";
import { assertFresh } from "./auth/sessions";
import { assertMediaReferences } from "./media/storage";
export const brandingKeys = [
  "logoUrl",
  "telULogoUrl",
  "identityImageUrl",
  "divisionImageUrl",
  "divisionImageUrl1",
  "divisionImageUrl2",
  "divisionImageUrl3",
  "divisionImageUrl4",
  "jumbotronUrl",
  "logoMeaningImageUrl",
] as const;
const brandingMedia = z.union([z.literal(""), mediaUrlSchema()]).optional();
const publicLink = z
  .union([
    z.literal(""),
    z
      .url()
      .max(2000)
      .refine((value) => {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password;
      }, "Gunakan tautan HTTPS tanpa kredensial."),
  ])
  .optional();
export const settingsSchema = z
  .object({
    organization: z.string().trim().min(3).max(150).optional(),
    email: z.email().optional(),
    address: z.string().max(500).optional(),
    map: publicLink,
    instagram: publicLink,
    tiktok: publicLink,
    youtube: publicLink,
    profileHistory: z.string().trim().max(10000).optional(),
    profileVision: z.string().trim().max(10000).optional(),
    profileMissions: z.string().trim().max(10000).optional(),
    logoUrl: brandingMedia,
    telULogoUrl: brandingMedia,
    identityImageUrl: brandingMedia,
    divisionImageUrl: brandingMedia,
    divisionImageUrl1: brandingMedia,
    divisionImageUrl2: brandingMedia,
    divisionImageUrl3: brandingMedia,
    divisionImageUrl4: brandingMedia,
    jumbotronUrl: brandingMedia,
    logoMeaningImageUrl: brandingMedia,
    whatsapp: z
      .string()
      .regex(/^\+?[0-9]{8,16}$/)
      .optional(),
  })
  .strict();
export async function getSettings(principal: Principal) {
  requirePermission(principal, "settings:read");
  return getDb().siteSettings.findUniqueOrThrow({
    where: { id: 1 },
    select: { managementYear: true, recruitmentActive: true, config: true },
  });
}
export async function updateSettings(
  principal: Principal,
  input: z.infer<typeof settingsSchema>,
  ctx: RequestContext,
) {
  requirePermission(principal, "settings:write");
  const validated = settingsSchema.parse(input);
  return getDb().$transaction(async (tx) => {
    await assertFresh(tx, principal, "settings:write");
    await assertMediaReferences(
      tx,
      brandingKeys.map((key) => validated[key] || ""),
      ["branding"],
      "public",
    );
    await tx.$queryRaw`SELECT id FROM "SiteSettings" WHERE id=1 FOR UPDATE`;
    const before = await tx.siteSettings.findUniqueOrThrow({
      where: { id: 1 },
    });
    const previous =
      before.config && typeof before.config === "object" && !Array.isArray(before.config)
        ? before.config
        : {};
    const row = await tx.siteSettings.update({
      where: { id: 1 },
      data: { config: { ...previous, ...validated } },
      select: { managementYear: true, recruitmentActive: true, config: true },
    });
    await writeAudit(tx, {
      actorType: "USER",
      actorId: principal.userId,
      action: "SETTINGS_UPDATED",
      context: ctx,
    });
    return row;
  });
}
export async function listAudit(principal: Principal, input: { cursor?: string; limit?: number }) {
  requirePermission(principal, "audit:read");
  const validated = z
    .object({
      cursor: z.uuid().optional(),
      limit: z.number().int().min(1).max(100).default(25),
    })
    .parse(input);
  const rows = await getDb().auditLog.findMany({
    take: validated.limit + 1,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(validated.cursor ? { cursor: { id: validated.cursor }, skip: 1 } : {}),
  });
  const hasNext = rows.length > validated.limit;
  return {
    rows: rows.slice(0, validated.limit),
    cursor: hasNext ? rows[validated.limit - 1].id : null,
  };
}
