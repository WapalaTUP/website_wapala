import { handleEventUpload } from "@/server/http/event-public-handlers";
export const runtime = "nodejs";
export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleEventUpload(request, context);
}
