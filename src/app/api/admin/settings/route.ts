import { route, authenticated, jsonResponse } from "@/server/http/auth-handler";
import { readJson } from "@/server/http/body";
import { getSettings, updateSettings, settingsSchema } from "@/server/settings";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return route(request, async () => {
    const { principal } = await authenticated(request, "settings:read");
    return jsonResponse(await getSettings(principal));
  });
}
export function PATCH(request: Request) {
  return route(request, async (ctx) => {
    const { principal } = await authenticated(request, "settings:write");
    return jsonResponse(
      await updateSettings(
        principal,
        await readJson(request, settingsSchema),
        ctx,
      ),
    );
  });
}
