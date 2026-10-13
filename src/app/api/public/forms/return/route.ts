import { route, jsonResponse } from "@/server/http/auth-handler";
import { readJson } from "@/server/http/body";
import { publicFormRequest, publicReturnSchema, requestPublicReturn } from "@/server/domains/public-forms";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return route(request, async ctx => {
    const owner = await publicFormRequest(request, ctx, "return");
    return jsonResponse(await requestPublicReturn(await readJson(request, publicReturnSchema), owner, ctx));
  });
}
