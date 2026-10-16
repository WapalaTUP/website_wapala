import { route } from "@/server/http/auth-handler";
import { publishedBook } from "@/server/domains/books";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(request, async () => {
    const book = await publishedBook((await params).id, true);
    return new Response(new Uint8Array(book.bytes!), {
      headers: {
        "Content-Type": book.mime,
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  });
}
