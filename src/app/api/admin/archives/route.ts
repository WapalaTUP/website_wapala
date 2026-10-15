import { route, authenticated, jsonResponse } from "@/server/http/auth-handler";
import {
  listArchives,
  restoreArchive,
  archiveRestoreSchema,
} from "@/server/domains/archives";
import { readJson } from "@/server/http/body";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return route(request, async () => {
    const { principal } = await authenticated(request, "users:write");
    return jsonResponse({ rows: await listArchives(principal) });
  });
}
export function POST(request: Request) {
  return route(request, async (ctx) => {
    const { principal } = await authenticated(request, "users:write");
    return jsonResponse(
      await restoreArchive(
        principal,
        await readJson(request, archiveRestoreSchema),
        ctx,
      ),
    );
  });
}
