import { route, readCookie, cookieName } from "@/server/http/auth-handler";
import { resolveSession } from "@/server/auth/sessions";
import { readMedia } from "@/server/media/storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return route(request, async () => {
    const principal = await resolveSession(
      readCookie(request, cookieName("session")) || "",
    );
    const media = await readMedia((await params).id, principal);
    return new Response(new Uint8Array(media.bytes), {
      headers: {
        "Content-Type": media.mime,
        "Cache-Control":
          media.visibility === "public"
            ? "public, max-age=86400"
            : "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        ETag: '"' + media.checksum + '"',
      },
    });
  });
}
