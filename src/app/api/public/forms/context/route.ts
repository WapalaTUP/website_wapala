import { route, jsonResponse, cookieHeader, readCookie } from "@/server/http/auth-handler";
import { createPreAuthToken } from "@/server/security/csrf";
import { formOwnerCookieName, issueFormOwner, verifyFormOwner } from "@/server/domains/public-forms";
import { getConfig } from "@/server/config";
import { takeThrottle } from "@/server/security/throttle";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return route(request, async ctx => {
    await takeThrottle("public-context:" + ctx.ipDigest, 120, 3600000);
    const csrfToken = createPreAuthToken();
    let owner = readCookie(request, formOwnerCookieName()) || "";
    try { verifyFormOwner(owner); } catch { owner = issueFormOwner(); }
    const response = jsonResponse({ csrfToken });
    response.headers.append("Set-Cookie", cookieHeader("preauth", csrfToken, 900));
    response.headers.append("Set-Cookie", `${formOwnerCookieName()}=${owner}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${getConfig().production ? "; Secure" : ""}`);
    return response;
  });
}
