import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { route } from "../../src/server/http/auth-handler";
import { readJson } from "../../src/server/http/body";
test("import validation response identifies CSV row/field without echoing private source values", async () => {
  const saved = {
    APP_URL: process.env.APP_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    SECURITY_KEY: process.env.SECURITY_KEY,
  };
  Object.assign(process.env, {
    APP_URL: "http://127.0.0.1:3000",
    DATABASE_URL: "postgresql://test:test@127.0.0.1/wapala_test",
    SECURITY_KEY: Buffer.alloc(32, 1).toString("base64"),
  });
  try {
    const request = new Request(
      "http://127.0.0.1:3000/api/admin/inventory/import",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rows: [{ code: "", name: "private-source-value" }],
        }),
      },
    );
    const response = await route(request, async () => {
      await readJson(
        request,
        z.object({
          rows: z.array(
            z.object({ code: z.string().min(1), name: z.string() }),
          ),
        }),
      );
      return Response.json({});
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.issues?.[0].row, 2);
    assert.equal(body.issues[0].field, "code");
    assert.ok(!JSON.stringify(body).includes("private-source-value"));
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
