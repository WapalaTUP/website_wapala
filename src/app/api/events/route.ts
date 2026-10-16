import { route, jsonResponse } from "@/server/http/auth-handler";
import { publicEvents, publicEvent } from "@/server/domains/events";
export function GET(request: Request) {
  return route(request, async () => {
    const id = new URL(request.url).searchParams.get("id");
    return jsonResponse(id ? { event: await publicEvent(id) } : { events: await publicEvents() });
  });
}
