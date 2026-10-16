import "server-only";
import sharp from "sharp";
import { validateEpub } from "./epub";
import { DomainError } from "../errors";
const maxBytes = 5 * 1024 * 1024;
function imageFormat(bytes: Buffer) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP")
    return "image/webp";
  return "";
}
export async function sanitizeImage(bytes: Buffer, mime: string) {
  if (!bytes.length || bytes.length > maxBytes)
    throw new DomainError("MEDIA_TOO_LARGE", 413, "Foto maksimal 5 MB.");
  if (!imageFormat(bytes) || imageFormat(bytes) !== mime)
    throw new DomainError("INVALID_MEDIA", 400, "Gunakan foto JPG, PNG, atau WebP asli.");
  try {
    const image = sharp(bytes, { limitInputPixels: 24000000, failOn: "error" });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || (metadata.pages || 1) > 1) throw new Error();
    const output = await image
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 88 })
      .timeout({ seconds: 15 })
      .toBuffer({ resolveWithObject: true });
    return {
      bytes: output.data,
      mime: "image/webp",
      extension: "webp" as const,
      width: output.info.width,
      height: output.info.height,
    };
  } catch {
    throw new DomainError(
      "INVALID_MEDIA",
      400,
      "Foto tidak valid atau terlalu besar untuk diproses.",
    );
  }
}
export function validateBook(bytes: Buffer, mime: string) {
  if (!bytes.length || bytes.length > 50 * 1024 * 1024)
    throw new DomainError("MEDIA_TOO_LARGE", 413, "Buku maksimal 50 MB.");
  if (mime !== "application/pdf" || bytes.subarray(0, 5).toString() !== "%PDF-")
    throw new DomainError("INVALID_MEDIA", 400, "Gunakan dokumen PDF asli.");
  return {
    bytes,
    mime: "application/pdf",
    extension: "pdf" as const,
    width: null,
    height: null,
  };
}
export async function sanitizeBook(bytes: Buffer, mime: string) {
  if (mime === "application/pdf") return validateBook(bytes, mime);
  if (!bytes.length || bytes.length > 50 * 1024 * 1024)
    throw new DomainError("MEDIA_TOO_LARGE", 413, "Buku maksimal 50 MB.");
  if (mime !== "application/epub+zip" || bytes.subarray(0, 4).toString("hex") !== "504b0304")
    throw new DomainError("INVALID_MEDIA", 400, "Gunakan buku PDF atau EPUB asli.");
  try {
    await validateEpub(bytes);
  } catch {
    throw new DomainError(
      "INVALID_MEDIA",
      400,
      "EPUB tidak valid, memuat konten aktif/tautan eksternal, atau melampaui batas pemrosesan.",
    );
  }
  return {
    bytes,
    mime: "application/epub+zip",
    extension: "epub" as const,
    width: null,
    height: null,
  };
}
