import { z } from "zod";
import { route, authenticated, jsonResponse } from "@/server/http/auth-handler";
import { readJson } from "@/server/http/body";
import { deleteTag, renameTag } from "@/server/domains/tags";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const renameSchema = z.object({ name: z.string().trim().min(1).max(60) }).strict();
export function PATCH(request: Request, { params }: Context) {
  return route(request, async (ctx) => {
    const { principal } = await authenticated(request, "content:write");
    const id = z.uuid().parse((await params).id);
    const body = await readJson(request, renameSchema, 4096);
    return jsonResponse(await renameTag(principal, id, body.name, ctx));
  });
}
export function DELETE(request: Request, { params }: Context) {
  return route(request, async (ctx) => {
    const { principal } = await authenticated(request, "content:write");
    const id = z.uuid().parse((await params).id);
    return jsonResponse(await deleteTag(principal, id, ctx));
  });
}
