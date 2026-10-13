import { route, jsonResponse } from "@/server/http/auth-handler";
import { readJson } from "@/server/http/body";
import { publicFormRequest, publicRevisionSchema, revisePublicApplicant } from "@/server/domains/public-forms";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return route(request, async ctx => {
    const owner = await publicFormRequest(request, ctx, "revise");
    return jsonResponse(await revisePublicApplicant(await readJson(request, publicRevisionSchema, 65536), owner, ctx));
  });
}
