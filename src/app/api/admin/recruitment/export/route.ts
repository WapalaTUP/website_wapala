import { route, authenticated } from "@/server/http/auth-handler";
import { exportApplicants } from "@/server/domains/operational-export";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return route(request, async () => {
    const { principal } = await authenticated(request, "recruitment:read"),
      q = new URL(request.url).searchParams;
    const format = z.enum(["xlsx", "pdf"]).parse(q.get("format") || "xlsx"),
      year = Number(q.get("year"));
    const bytes = await exportApplicants(principal, year, format);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type":
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="OR-${year}.${format}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
