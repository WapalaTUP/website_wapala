import { route, authenticated, jsonResponse } from "@/server/http/auth-handler";
import { readJson } from "@/server/http/body";
import {
  listPeriods,
  listApplicants,
  setRecruitmentPeriod,
  periodSchema,
} from "@/server/domains/recruitment";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return route(request, async () => {
    const { principal } = await authenticated(request, "recruitment:read");
    const periods = await listPeriods(principal);
    const year = periodSchema.shape.year.parse(
      Number(
        new URL(request.url).searchParams.get("year") ||
          periods[0]?.year ||
          new Date().getFullYear(),
      ),
    );
    return jsonResponse({
      periods,
      year,
      applicants: await listApplicants(principal, year),
    });
  });
}
export function POST(request: Request) {
  return route(request, async (ctx) => {
    const { principal } = await authenticated(request, "recruitment:write");
    const { year, active } = await readJson(request, periodSchema);
    return jsonResponse(await setRecruitmentPeriod(principal, year, active, ctx));
  });
}
