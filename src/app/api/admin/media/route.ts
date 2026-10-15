import { route, authenticated, jsonResponse } from "@/server/http/auth-handler";
import { readMultipart } from "@/server/http/multipart";
import { requirePermission } from "@/server/auth/policy";
import {
  registerMedia,
  purposeSchema,
  mediaWritePermission,
} from "@/server/media/storage";
import { takeThrottle } from "@/server/security/throttle";
import { DomainError } from "@/server/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return route(request, async (ctx) => {
    const { principal } = await authenticated(request);
    const purpose = purposeSchema.parse(request.headers.get("x-media-purpose"));
    requirePermission(principal, mediaWritePermission(purpose));
    await takeThrottle("admin-upload:" + principal.userId, 20, 3600000);
    const form = await readMultipart(
      request,
      (purpose === "book" ? 50 : 5) * 1024 * 1024 + 65536,
    );
    if (
      form.get("purpose") !== purpose ||
      form.getAll("file").length !== 1 ||
      [...form.keys()].some((k) => !["file", "purpose"].includes(k))
    )
      throw new DomainError("INVALID_INPUT", 400);
    const file = form.get("file");
    if (!(file instanceof File)) throw new DomainError("INVALID_INPUT", 400);
    return jsonResponse(
      await registerMedia(
        principal,
        {
          bytes: Buffer.from(await file.arrayBuffer()),
          mime: file.type,
          purpose,
        },
        ctx,
      ),
      201,
    );
  });
}
