import { route, authenticated, jsonResponse } from "@/server/http/auth-handler";
import { readJson } from "@/server/http/body";
import { memberImportSchema, importMembers } from "@/server/domains/records";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return route(request, async (ctx) => {
    const { principal } = await authenticated(request, "members:write");
    const { rows } = await readJson(request, memberImportSchema, 2 * 1024 * 1024);
    return jsonResponse(await importMembers(principal, rows, ctx), 201);
  });
}
