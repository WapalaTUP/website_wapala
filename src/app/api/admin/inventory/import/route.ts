import { route, authenticated, jsonResponse } from "@/server/http/auth-handler";
import { readJson } from "@/server/http/body";
import { equipmentImportSchema, importEquipment } from "@/server/domains/inventory";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return route(request, async (ctx) => {
    const { principal } = await authenticated(request, "inventory:write");
    const { rows } = await readJson(request, equipmentImportSchema, 2 * 1024 * 1024);
    return jsonResponse(await importEquipment(principal, rows, ctx), 201);
  });
}
