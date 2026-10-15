import { route, authenticated, jsonResponse } from "@/server/http/auth-handler";
import { listLoans } from "@/server/domains/loans";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return route(request, async () => {
    const { principal } = await authenticated(request, "loans:write");
    return jsonResponse({ loans: await listLoans(principal) });
  });
}
