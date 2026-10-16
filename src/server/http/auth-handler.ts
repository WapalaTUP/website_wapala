import "server-only";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { getConfig } from "../config";
import { DomainError } from "../errors";
import { EventAnswerError } from "../domains/event-registrations";
import { resolveSessionRecord } from "../auth/sessions";
import { requirePermission, type Permission } from "../auth/policy";
import { assertOrigin, csrfForSession, validatePreAuthToken } from "../security/csrf";
import { constantEqual, digestToken } from "../security/tokens";
import { requestContext, type RequestContext } from "../security/request-context";
export const cookieName = (kind: "session" | "preauth") =>
  (getConfig().production ? "__Host-" : "") + "wapala." + kind;
export function readCookie(request: Request, name: string) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(name + "="))
    ?.slice(name.length + 1);
}
export function cookieHeader(kind: "session" | "preauth", value: string, maxAge: number) {
  return `${cookieName(kind)}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${getConfig().production ? "; Secure" : ""}`;
}
export function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function route(request: Request, fn: (ctx: RequestContext) => Promise<Response>) {
  const requestId = randomUUID();
  try {
    return await fn({ ...requestContext(request), requestId });
  } catch (e) {
    if (e instanceof EventAnswerError)
      return jsonResponse(
        {
          error: e.message,
          code: e.code,
          questions: e.questions.slice(0, 200),
          requestId,
        },
        e.status,
      );
    if (e instanceof DomainError)
      return jsonResponse({ error: e.message, code: e.code, requestId }, e.status);
    if (e instanceof ZodError)
      return jsonResponse(
        {
          error: e.issues.some((issue) => issue.path[0] === "fields")
            ? "Periksa field: " +
              [
                ...new Set(
                  e.issues
                    .map((issue) => issue.path.filter((part) => part !== "fields").join("."))
                    .filter(Boolean),
                ),
              ]
                .slice(0, 10)
                .join(", ") +
              "."
            : "Periksa isian formulir.",
          code: "INVALID_INPUT",
          requestId,
          ...(e.issues.some((issue) => issue.path[0] === "rows")
            ? {
                issues: e.issues.slice(0, 100).map((issue) => ({
                  row: typeof issue.path[1] === "number" ? issue.path[1] + 2 : 1,
                  field: String(issue.path[2] || "file"),
                  message: issue.message,
                })),
              }
            : {}),
        },
        400,
      );
    console.error(
      JSON.stringify({
        event: "request_failed",
        requestId,
        code: "INTERNAL",
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack?.split("\n").slice(0, 4).join(" | ") : undefined,
      }),
    );
    return jsonResponse(
      {
        error: "Layanan belum dapat memproses permintaan.",
        code: "INTERNAL",
        requestId,
      },
      500,
    );
  }
}
export function assertPreAuth(request: Request) {
  assertOrigin(request);
  validatePreAuthToken(
    readCookie(request, cookieName("preauth")),
    request.headers.get("x-csrf-token") || undefined,
  );
}
export async function authenticated(request: Request, permission?: Permission) {
  const token = readCookie(request, cookieName("session")) || "",
    record = await resolveSessionRecord(token);
  if (!record) throw new DomainError("UNAUTHENTICATED", 401, "Silakan login kembali.");
  const { principal, csrfDigest } = record;
  if (permission) requirePermission(principal, permission);
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    assertOrigin(request);
    const csrf = request.headers.get("x-csrf-token") || "";
    if (
      !constantEqual(csrf, csrfForSession(token)) ||
      !constantEqual(csrfDigest, digestToken(csrf))
    )
      throw new DomainError("CSRF_DENIED", 403);
  }
  return { principal, token };
}
