import { z } from "zod";
import { MEDIA_URL_PATTERN } from "./media-url";

export function parseExternalAlbumUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    const instagram = /^\/(p|reel|tv)\/([A-Za-z0-9_-]{1,100})\/?$/.exec(url.pathname);
    if (["instagram.com", "www.instagram.com"].includes(host) && instagram) {
      const src = `https://www.instagram.com/${instagram[1]}/${instagram[2]}/`;
      return { type: "instagram" as const, src, embed: `${src}embed/` };
    }
    const tiktok = /^\/@[A-Za-z0-9_.]{1,50}\/video\/(\d{5,30})\/?$/.exec(url.pathname);
    if (["tiktok.com", "www.tiktok.com"].includes(host) && tiktok) {
      return {
        type: "tiktok" as const,
        src: `https://www.tiktok.com${url.pathname.replace(/\/$/, "")}`,
        embed: `https://www.tiktok.com/player/v1/${tiktok[1]}`,
      };
    }
  } catch {
    /* Invalid and untrusted URLs do not become embeds. */
  }
  return null;
}

export const albumMediaItemSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[A-Za-z0-9_-]+$/),
    type: z.enum(["image", "video", "instagram", "tiktok"]),
    src: z.string().min(1).max(2048),
    caption: z.string().max(500).default(""),
    orientation: z.enum(["portrait", "landscape"]).default("landscape"),
  })
  .strict()
  .superRefine((item, ctx) => {
    const valid =
      item.type === "image" || item.type === "video"
        ? MEDIA_URL_PATTERN.test(item.src) || (item.type === "image" && safeLegacyImage(item.src))
        : parseExternalAlbumUrl(item.src)?.type === item.type;
    if (!valid)
      ctx.addIssue({
        code: "custom",
        path: ["src"],
        message: "Gunakan unggahan terdaftar atau tautan Instagram/TikTok yang valid.",
      });
  });
export const albumMediaItemsSchema = z
  .array(albumMediaItemSchema)
  .max(500)
  .superRefine((items, ctx) => {
    if (new Set(items.map((item) => item.id)).size !== items.length)
      ctx.addIssue({ code: "custom", message: "ID media harus unik." });
  });
export type AlbumMediaItem = z.infer<typeof albumMediaItemSchema>;
export type AlbumFields = Record<string, string | string[]>;
export function mediaOrientation(
  width: number | null,
  height: number | null,
): AlbumMediaItem["orientation"] {
  return width !== null &&
    height !== null &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > width
    ? "portrait"
    : "landscape";
}
function safeLegacyImage(value: string) {
  return /^\/images\/[A-Za-z0-9_./-]+$/.test(value) && !value.includes("..");
}
function legacyArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (!value || value.length > 150000) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed))
      return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    /* Older single image fields were not JSON encoded. */
  }
  return [value];
}
export function parseAlbumMedia(fields: AlbumFields): AlbumMediaItem[] {
  if (typeof fields.media_items === "string" && fields.media_items.trim()) {
    if (fields.media_items.length > 150000) return [];
    try {
      const parsed = albumMediaItemsSchema.safeParse(JSON.parse(fields.media_items));
      return parsed.success ? parsed.data : [];
    } catch {
      return [];
    }
  }
  const images = legacyArray(fields.gambar),
    captions = legacyArray(fields.keterangan_foto);
  const cover = typeof fields.sampul === "string" ? fields.sampul : "";
  return [...new Set([cover, ...images])]
    .filter((src) => MEDIA_URL_PATTERN.test(src) || safeLegacyImage(src))
    .slice(0, 500)
    .map((src, index) => ({
      id: `legacy-${index}`,
      type: "image",
      src,
      caption: (captions[images.indexOf(src)] || "").slice(0, 500),
      orientation: "landscape",
    }));
}
