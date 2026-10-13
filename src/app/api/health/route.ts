import { getDb } from "@/server/db";
import { healthResponse } from "@/server/http/health";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() {
  return healthResponse(() => getDb().$queryRaw`SELECT 1`);
}
