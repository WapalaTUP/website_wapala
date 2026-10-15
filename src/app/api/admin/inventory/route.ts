import { route, authenticated, jsonResponse } from "@/server/http/auth-handler";
import { readJson } from "@/server/http/body";
import {
  equipmentSchema,
  equipmentAvailabilitySchema,
  listEquipment,
  saveEquipment,
  setEquipmentAvailability,
} from "@/server/domains/inventory";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return route(request, async () => {
    const { principal } = await authenticated(request, "inventory:write");
    return jsonResponse({ equipment: await listEquipment(principal) });
  });
}
export function POST(request: Request) {
  return route(request, async (ctx) => {
    const { principal } = await authenticated(request, "inventory:write");
    const input = await readJson(request, equipmentSchema);
    return jsonResponse(
      await saveEquipment(principal, input, ctx),
      input.id ? 200 : 201,
    );
  });
}
export function PATCH(request: Request) {
  return route(request, async (ctx) => {
    const { principal } = await authenticated(request, "inventory:write");
    const input = await readJson(request, equipmentAvailabilitySchema);
    return jsonResponse(await setEquipmentAvailability(principal, input, ctx));
  });
}
