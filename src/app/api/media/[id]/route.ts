import { route, readCookie, cookieName } from "@/server/http/auth-handler";
import { resolveSession } from "@/server/auth/sessions";
import { readMediaStream } from "@/server/media/storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return route(request, async () => {
    const principal = await resolveSession(
      readCookie(request, cookieName("session")) || "",
    );
    const media = await readMediaStream((await params).id, principal);
    const etag = '"' + media.checksum + '"';
    const headers: Record<string, string> = {
      "Content-Type": media.mime,
      "Cache-Control":
        media.visibility === "public"
          ? "public, max-age=86400"
          : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      ETag: etag,
    };
    // ETag berasal dari checksum DB: 304 tanpa menyentuh disk.
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch.split(",").map((v) => v.trim()).includes(etag))
      return new Response(null, { status: 304, headers });
    return new Response(media.stream, { headers });
  });
}
