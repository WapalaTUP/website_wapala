import { z } from "zod";
import { route, authenticated, jsonResponse } from "@/server/http/auth-handler";
import { readJson } from "@/server/http/body";
import { createTag, listTagsWithUsage } from "@/server/domains/tags";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return route(request, async () => {
    await authenticated(request, "content:write");
    return jsonResponse({ tags: await listTagsWithUsage() });
  });
}
const createSchema = z.object({ name: z.string().trim().min(1).max(60) }).strict();
export function POST(request: Request) {
  return route(request, async (ctx) => {
    const { principal } = await authenticated(request, "content:write");
    const body = await readJson(request, createSchema, 4096);
    return jsonResponse(await createTag(principal, body.name, ctx), 201);
  });
}
