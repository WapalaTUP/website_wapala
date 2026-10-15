import test from "node:test";
import assert from "node:assert/strict";
import { authPost } from "../src/components/auth/client-api";

test("login refreshes stale preauth context before sending the password", async () => {
  const original = globalThis.fetch;
  // Only the browser transport is substituted; authPost's request selection and errors remain real.
  globalThis.fetch = async (url, init) => {
    if (String(url) === "/api/auth/context")
      return Response.json({
        setupRequired: false,
        csrfToken: "current-cookie-token",
      });
    const csrf = new Headers(init?.headers).get("x-csrf-token");
    return csrf === "current-cookie-token"
      ? Response.json({ redirectTo: "/admin/foundation" })
      : Response.json(
          { error: "Expired context", code: "CSRF_DENIED" },
          { status: 403 },
        );
  };
  try {
    assert.deepEqual(
      await authPost(
        "login",
        { email: "test@example.invalid", password: "test-only-passphrase" },
        "stale-tab-token",
      ),
      { redirectTo: "/admin/foundation" },
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("authenticated password change keeps its session-bound CSRF token", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) =>
    String(url) === "/api/auth/password" &&
    new Headers(init?.headers).get("x-csrf-token") === "session-csrf"
      ? Response.json({ redirectTo: "/wapala" })
      : Response.json({ error: "Invalid session token" }, { status: 403 });
  try {
    assert.deepEqual(
      await authPost(
        "password",
        {
          currentPassword: "test-current-passphrase",
          newPassword: "test-new-passphrase",
        },
        "session-csrf",
      ),
      { redirectTo: "/wapala" },
    );
  } finally {
    globalThis.fetch = original;
  }
});
