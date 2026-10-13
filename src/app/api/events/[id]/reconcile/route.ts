import { z } from "zod";
import { route, jsonResponse } from "@/server/http/auth-handler";
import { readJson } from "@/server/http/body";
import { assertOrigin } from "@/server/security/csrf";
import { verifyEventReplayToken } from "@/server/security/event-form-token";
import {
  registrationSchema,
  reconcileEventRegistration,
} from "@/server/domains/event-registrations";
import { takeThrottle } from "@/server/security/throttle";
import { DomainError } from "@/server/errors";
const schema = registrationSchema.extend({
  website: z.string().max(200).default(""),
});
export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return route(request, async (ctx) => {
    assertOrigin(request);
    const { id } = await context.params,
      t = verifyEventReplayToken(request.headers.get("x-event-token") || "");
    const { website, ...v } = await readJson(request, schema, 1048576);
    if (
      website ||
      id !== t.eventId ||
      v.eventId !== id ||
      v.revisionId !== t.revisionId
    )
      throw new DomainError("INVALID_INPUT", 400);
    await takeThrottle("event-reconcile:" + ctx.ipDigest, 100, 3600000);
    return jsonResponse(await reconcileEventRegistration(v, t.ownerDigest));
  });
}
