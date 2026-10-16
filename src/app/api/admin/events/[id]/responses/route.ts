import { route, authenticated, jsonResponse } from "@/server/http/auth-handler";
import { listEventRegistrations, responseFilterSchema } from "@/server/domains/event-registrations";
export function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(request, async () => {
    const { principal } = await authenticated(request, "events:write");
    const { id } = await context.params;
    const f = responseFilterSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return jsonResponse(await listEventRegistrations(principal, id, f));
  });
}
