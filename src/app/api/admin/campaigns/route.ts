import { route, authenticated, jsonResponse } from "@/server/http/auth-handler";
import { readJson } from "@/server/http/body";
import {
  campaignSchema,
  listCampaigns,
  listDonations,
  saveCampaign,
} from "@/server/domains/campaigns";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return route(request, async () => {
    const { principal } = await authenticated(request, "campaigns:write");
    return jsonResponse({
      campaigns: await listCampaigns(principal),
      donations: await listDonations(principal),
    });
  });
}
export function POST(request: Request) {
  return route(request, async (ctx) => {
    const { principal } = await authenticated(request, "campaigns:write");
    const input = await readJson(request, campaignSchema, 32768);
    return jsonResponse(
      await saveCampaign(principal, input, ctx),
      input.id ? 200 : 201,
    );
  });
}
