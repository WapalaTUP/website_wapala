import { authGet, authPost } from "@/server/http/auth-endpoints";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ action: string }> };
export async function GET(request: Request, ctx: Context) {
  return authGet(request, (await ctx.params).action);
}
export async function POST(request: Request, ctx: Context) {
  return authPost(request, (await ctx.params).action);
}
