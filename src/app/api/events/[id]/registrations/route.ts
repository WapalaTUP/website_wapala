import { handleEventRegistration } from "@/server/http/event-public-handlers";
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleEventRegistration(request, context);
}
