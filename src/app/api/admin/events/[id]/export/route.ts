import { route, authenticated } from "@/server/http/auth-handler";
import { loadEventExport } from "@/server/domains/event-export";
import { responseFilterSchema } from "@/server/domains/event-registrations";
export const runtime = "nodejs";
export function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return route(request, async () => {
    const { principal } = await authenticated(request, "events:write");
    const { id } = await context.params;
    const f = responseFilterSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const buffer = await loadEventExport(principal, id, f);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="Pendaftar-Event-' + id + '.xlsx"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
