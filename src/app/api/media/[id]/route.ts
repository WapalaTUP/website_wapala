import { route, readCookie, cookieName } from "@/server/http/auth-handler";
import { resolveSession } from "@/server/auth/sessions";
import { readMediaStream } from "@/server/media/storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(request, async () => {
    const principal = await resolveSession(readCookie(request, cookieName("session")) || "");
    const media = await readMediaStream((await params).id, principal, {
      range: request.headers.get("range"),
      ifRange: request.headers.get("if-range"),
    });
    const etag = '"' + media.checksum + '"';
    const headers: Record<string, string> = {
      "Content-Type": media.mime,
      "Cache-Control":
        media.visibility === "public" ? "public, max-age=86400" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      ETag: etag,
      "Accept-Ranges": "bytes",
    };
    // ETag berasal dari checksum DB: 304 tanpa menyentuh disk.
    const ifNoneMatch = request.headers.get("if-none-match");
    if (
      ifNoneMatch &&
      ifNoneMatch
        .split(",")
        .map((v) => v.trim())
        .includes(etag)
    ) {
      await media.stream?.cancel();
      return new Response(null, { status: 304, headers });
    }
    if (media.range === null)
      return new Response(null, {
        status: 416,
        headers: { ...headers, "Content-Range": `bytes */${media.size}` },
      });
    if (media.range) {
      headers["Content-Range"] = `bytes ${media.range.start}-${media.range.end}/${media.size}`;
      headers["Content-Length"] = String(media.range.end - media.range.start + 1);
    } else headers["Content-Length"] = String(media.size);
    return new Response(media.stream, { status: media.range ? 206 : 200, headers });
  });
}
