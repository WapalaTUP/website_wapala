import "server-only";
import sharp from "sharp";
import { validateEpub } from "./epub";
import { DomainError } from "../errors";
import { spawn } from "node:child_process";
const maxBytes = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

// Check complete ISO BMFF framing before passing scanned bytes to ffprobe.
// The probe receives stdin only and cannot open network URLs or file references.
export async function sanitizeVideo(bytes: Buffer, mime: string) {
  if (!bytes.length || bytes.length > MAX_VIDEO_BYTES)
    throw new DomainError("MEDIA_TOO_LARGE", 413, "Video maksimal 50 MB.");
  const invalid = () =>
    new DomainError(
      "INVALID_MEDIA",
      400,
      "Gunakan video MP4 H.264/H.265 asli, maksimal 20 menit dan resolusi 4K.",
    );
  if (mime !== "video/mp4") throw invalid();
  let offset = 0,
    boxes = 0;
  const types = new Set<string>();
  while (offset < bytes.length) {
    if (++boxes > 10000 || bytes.length - offset < 8) throw invalid();
    let size = bytes.readUInt32BE(offset),
      header = 8;
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (size === 1) {
      if (bytes.length - offset < 16) throw invalid();
      const large = bytes.readBigUInt64BE(offset + 8);
      if (large > BigInt(bytes.length)) throw invalid();
      size = Number(large);
      header = 16;
    } else if (size === 0) size = bytes.length - offset;
    if (size < header || offset + size > bytes.length) throw invalid();
    if (offset === 0 && type !== "ftyp") throw invalid();
    if (type === "ftyp" && size < 16) throw invalid();
    types.add(type);
    offset += size;
  }
  if (!types.has("ftyp") || !types.has("moov") || !types.has("mdat")) throw invalid();
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn(
      /* turbopackIgnore: true */ process.env.MEDIA_FFPROBE || "ffprobe",
      [
        "-v",
        "error",
        "-threads",
        "1",
        "-max_alloc",
        "67108864",
        "-protocol_whitelist",
        "pipe",
        "-probesize",
        "52428800",
        "-analyzeduration",
        "10000000",
        "-show_entries",
        // FFmpeg 4.4 exposes this section as side_data, without the newer unique alias.
        "stream=codec_type,codec_name,width,height:side_data=rotation:format=format_name,duration",
        "-of",
        "json",
        "pipe:0",
      ],
      { shell: false, windowsHide: true, stdio: ["pipe", "pipe", "ignore"] },
    );
    let result = "",
      settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        child.kill();
        reject(error);
      } else resolve(result);
    };
    const timer = setTimeout(() => finish(invalid()), 15000);
    child.once("error", () =>
      finish(
        new DomainError("VIDEO_PROCESSOR_UNAVAILABLE", 503, "Pemeriksaan video belum tersedia."),
      ),
    );
    child.stdout.on("data", (data: Buffer) => {
      result += data.toString();
      if (result.length > 131072) finish(invalid());
    });
    child.stdin.on("error", () => {
      /* Exit code decides early pipe closure. */
    });
    child.once("close", (code) => finish(code === 0 ? undefined : invalid()));
    child.stdin.end(bytes);
  });
  try {
    const data = JSON.parse(output) as {
      streams?: Array<{
        codec_type: string;
        codec_name: string;
        width: number;
        height: number;
        side_data_list?: Array<{ rotation?: number }>;
      }>;
      format?: { format_name: string; duration: string };
    };
    const streams = data.streams || [],
      videos = streams.filter((stream) => stream.codec_type === "video");
    const duration = Number(data.format?.duration);
    if (
      !data.format?.format_name.split(",").includes("mp4") ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > 1200 ||
      videos.length !== 1 ||
      streams.length > 4 ||
      streams.some((s) => !["video", "audio"].includes(s.codec_type))
    )
      throw invalid();
    const video = videos[0];
    if (
      !["h264", "hevc"].includes(video.codec_name) ||
      !Number.isInteger(video.width) ||
      !Number.isInteger(video.height) ||
      video.width < 1 ||
      video.height < 1 ||
      Math.max(video.width, video.height) > 4096 ||
      video.width * video.height > 4096 * 2160
    )
      throw invalid();
    const rotation =
      video.side_data_list?.find((side) => typeof side.rotation === "number")?.rotation || 0;
    const swapped = Math.abs(rotation) % 180 === 90;
    return {
      bytes,
      mime: "video/mp4",
      extension: "mp4" as const,
      width: swapped ? video.height : video.width,
      height: swapped ? video.width : video.height,
    };
  } catch {
    throw invalid();
  }
}
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
