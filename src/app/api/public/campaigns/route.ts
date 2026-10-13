import { route, jsonResponse } from "@/server/http/auth-handler";
import { publicCampaigns } from "@/server/domains/campaigns";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return route(request, async () =>
    jsonResponse({ campaigns: await publicCampaigns() }),
  );
}
