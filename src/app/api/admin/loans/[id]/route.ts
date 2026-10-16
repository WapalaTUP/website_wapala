import { route, authenticated, jsonResponse } from "@/server/http/auth-handler";
import { readJson } from "@/server/http/body";
import { transitionLoan, transitionSchema } from "@/server/domains/loans";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(request, async (ctx) => {
    const { principal } = await authenticated(request, "loans:write");
    return jsonResponse(
      await transitionLoan(
        principal,
        (await params).id,
        await readJson(request, transitionSchema),
        ctx,
      ),
    );
  });
}
