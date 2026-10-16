import { route, authenticated, jsonResponse } from "@/server/http/auth-handler";
import { readJson } from "@/server/http/body";
import { listEvents, saveEvent, eventSaveSchema } from "@/server/domains/events";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return route(request, async () => {
    const { principal } = await authenticated(request, "events:write");
    return jsonResponse({ events: await listEvents(principal) });
  });
}
export function POST(request: Request) {
  return route(request, async (ctx) => {
    const { principal } = await authenticated(request, "events:write");
    const v = await readJson(request, eventSaveSchema, 1048576);
    return jsonResponse(await saveEvent(principal, v, ctx), v.id ? 200 : 201);
  });
}
