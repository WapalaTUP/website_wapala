import { route, authenticated } from "@/server/http/auth-handler";
import { exportOperational } from "@/server/domains/operational-export";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  return route(request, async () => {
    const kind = z
        .enum(["members", "inventory", "archives"])
        .parse((await params).kind),
      q = new URL(request.url).searchParams;
    const { principal } = await authenticated(
      request,
      kind === "members"
        ? "members:read"
        : kind === "inventory"
          ? "inventory:write"
          : "users:write",
    );
    const format = z.enum(["xlsx", "pdf"]).parse(q.get("format") || "xlsx"),
      archived =
        z.enum(["true", "false"]).parse(q.get("archived") || "false") ===
        "true";
    const bytes = await exportOperational(principal, kind, format, archived);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type":
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${kind}${archived ? "-arsip" : ""}.${format}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
