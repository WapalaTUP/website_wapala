import "server-only";
import { isAbsolute, join, resolve, relative } from "node:path";
export function mediaPath(root: string, id: string, extension: "webp" | "pdf" | "epub" | "mp4") {
  if (
    !isAbsolute(root) ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id) ||
    !["webp", "pdf", "epub", "mp4"].includes(extension)
  )
    throw new Error("Invalid media storage path");
  const target = resolve(root, id.slice(0, 2), id + "." + extension);
  const fromRoot = relative(resolve(root), target);
  if (!fromRoot || fromRoot.startsWith("..") || isAbsolute(fromRoot))
    throw new Error("Invalid media storage path");
  return target;
}
export function mediaRoot() {
  if (process.env.MEDIA_ROOT && isAbsolute(process.env.MEDIA_ROOT))
    return resolve(process.env.MEDIA_ROOT);
  if (process.env.NODE_ENV === "production")
    throw new Error("MEDIA_ROOT must be an absolute private storage path");
  return join(process.cwd(), ".local", "media");
}
