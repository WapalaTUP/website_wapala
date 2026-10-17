import { route, authenticated, jsonResponse } from "@/server/http/auth-handler";
import { readJson } from "@/server/http/body";
import { listContent, saveContent, contentSaveSchema } from "@/server/domains/records";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return route(request, async () => {
    const { principal } = await authenticated(request, "articles:submit");
    return jsonResponse({ records: await listContent(principal, "konten") });
  });
}
export function POST(request: Request) {
  return route(request, async (ctx) => {
    const { principal } = await authenticated(request, "articles:submit");
    return jsonResponse(
      await saveContent(
        principal,
        "konten",
        await readJson(request, contentSaveSchema("konten"), 262144),
        ctx,
      ),
    );
  });
}
