import { route, authenticated, jsonResponse } from "@/server/http/auth-handler";
import { readJson } from "@/server/http/body";
import { rollover, rolloverSchema } from "@/server/domains/management";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return route(request, async (ctx) => {
    const { principal } = await authenticated(request, "users:write");
    return jsonResponse(await rollover(principal, await readJson(request, rolloverSchema), ctx));
  });
}
