import { route, jsonResponse } from "@/server/http/auth-handler";
import { publicEvent } from "@/server/domains/events";
import { issueEventFormToken } from "@/server/security/event-form-token";
import { takeThrottle } from "@/server/security/throttle";
export function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(request, async (ctx) => {
    const { id } = await context.params;
    await takeThrottle("event-context:" + ctx.ipDigest, 200, 3600000);
    const event = await publicEvent(id);
    return jsonResponse({
      event,
      token: event.accepting ? issueEventFormToken(id, event.revisionId) : "",
    });
  });
}
