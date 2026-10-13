import { route, jsonResponse } from "@/server/http/auth-handler";
import { publishedBook } from "@/server/domains/books";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return route(request, async () =>
    jsonResponse(await publishedBook((await params).id)),
  );
}
