import { z } from "zod";
// Pola URL media internal. Versi ketat (UUID penuh) — id memang dibuat
// dengan randomUUID(), pola lama [a-f0-9-]{36} terlalu longgar.
export const MEDIA_URL_PATTERN =
  /^\/api\/media\/([a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/;
export function parseMediaUrl(url: string) {
  return MEDIA_URL_PATTERN.exec(url)?.[1] ?? null;
}
export function mediaUrlSchema() {
  return z.string().regex(MEDIA_URL_PATTERN);
}
