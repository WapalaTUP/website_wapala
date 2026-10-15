import { route, authenticated, jsonResponse } from "@/server/http/auth-handler";
import { readJson } from "@/server/http/body";
import { actOnEvent, eventActionSchema } from "@/server/domains/events";
export function POST(request: Request) {
  return route(request, async (ctx) => {
    const { principal } = await authenticated(request, "events:write");
    return jsonResponse(
      await actOnEvent(
        principal,
        await readJson(request, eventActionSchema),
        ctx,
      ),
    );
  });
}
