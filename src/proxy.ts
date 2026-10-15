import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy } from "./server/security/headers";
export function proxy(request: NextRequest) {
  const nonce = randomBytes(16).toString("base64"),
    csp = contentSecurityPolicy(nonce, process.env.NODE_ENV === "production");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|images|books|favicon.ico).*)"],
};
