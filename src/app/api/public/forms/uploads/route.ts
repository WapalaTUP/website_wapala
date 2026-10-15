import { handlePublicUpload } from "@/server/http/public-form-handlers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) { return handlePublicUpload(request); }
