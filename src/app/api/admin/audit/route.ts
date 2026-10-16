import { route, authenticated, jsonResponse } from "@/server/http/auth-handler";
import { listAudit } from "@/server/settings";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return route(request, async () => {
    const { principal } = await authenticated(request, "audit:read");
    const url = new URL(request.url);
    return jsonResponse(
      await listAudit(principal, {
        cursor: url.searchParams.get("cursor") || undefined,
        limit: url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined,
      }),
    );
  });
}
