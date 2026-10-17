import { z } from "zod";
import { parseMediaUrl } from "./media-url";
import { parseExternalAlbumUrl } from "./album-media";

export function safeArticleLink(value: string): string | null {
  if (/^\/(?!\/)[^\\\s]*$/.test(value) && !value.includes("..")) return value;
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
export function safeArticleMediaSource(value: string): string | null {
  return parseMediaUrl(value) ? value : null;
}
export function articleVideoEmbed(value: string): string | null {
  const external = parseExternalAlbumUrl(value);
  if (external) return external.embed;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    let id = "";
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname))
      id =
        url.pathname === "/watch"
          ? url.searchParams.get("v") || ""
          : url.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)$/)?.[1] || "";
    if (url.hostname === "youtu.be") id = url.pathname.slice(1);
    if (/^[\w-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
    if (["vimeo.com", "www.vimeo.com"].includes(url.hostname) && /^\/\d+$/.test(url.pathname))
      return `https://player.vimeo.com/video/${url.pathname.slice(1)}`;
    return null;
  } catch {
    return null;
  }
}
const blockSchema = z
  .object({
    id: z.string().min(1).max(100),
    type: z.enum(["paragraph", "heading", "quote", "list", "image", "video"]),
    text: z.string().max(30000).optional(),
    src: z.string().max(2000).optional(),
    caption: z.string().max(1000).optional(),
    credit: z.string().max(300).optional(),
    alt: z.string().max(500).optional(),
  })
  .strict()
  .superRefine((block, ctx) => {
    if (
      ["image", "video"].includes(block.type) &&
      (!block.src ||
        !(
          safeArticleMediaSource(block.src) ||
          (block.type === "video" && articleVideoEmbed(block.src))
        ))
    )
      ctx.addIssue({ code: "custom", message: "Sumber media tidak valid.", path: ["src"] });
  });
export const articleBlocksSchema = z
  .array(blockSchema)
  .max(200)
  .superRefine((blocks, ctx) => {
    if (new Set(blocks.map((block) => block.id)).size !== blocks.length)
      ctx.addIssue({ code: "custom", message: "ID blok harus unik." });
  });
export type ArticleBlock = z.infer<typeof blockSchema>;
export function parseArticleBlocks(fields: Record<string, unknown>): ArticleBlock[] {
  try {
    const raw: unknown = JSON.parse(String(fields.bloki || "[]"));
    if (Array.isArray(raw)) {
      const blocks = raw.slice(0, 200).flatMap((entry) => {
        const result = blockSchema.safeParse(entry);
        return result.success ? [result.data] : [];
      });
      if (blocks.length) return blocks;
    }
  } catch {
    /* Legacy text remains readable. */
  }
  return String(fields.isi || "")
    .split(/\n\s*\n/)
    .filter((text) => text.trim())
    .map((text, index) => ({ id: `legacy-${index}`, type: "paragraph", text }));
}
