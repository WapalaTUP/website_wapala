import { randomUUID } from "node:crypto";
export async function healthResponse(check: () => Promise<unknown>) {
  const requestId = randomUUID();
  try {
    await check();
    return Response.json(
      { status: "ok", requestId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "degraded", requestId },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
