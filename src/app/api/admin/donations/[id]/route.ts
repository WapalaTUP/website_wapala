import { z } from "zod";
import { route, authenticated, jsonResponse } from "@/server/http/auth-handler";
import { readJson } from "@/server/http/body";
import { reviewDonation } from "@/server/domains/campaigns";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(request, async (ctx) => {
    const { principal } = await authenticated(request, "campaigns:write");
    const { id } = await params;
    const input = await readJson(
      request,
      z
        .object({
          status: z.enum(["verified", "rejected"]),
          note: z.string().trim().max(2000),
        })
        .strict(),
    );
    return jsonResponse(await reviewDonation(principal, id, input.status, input.note, ctx));
  });
}
