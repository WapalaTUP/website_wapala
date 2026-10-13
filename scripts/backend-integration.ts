import "dotenv/config";
import { config } from "dotenv";
config({ path: ".local/backend.env", quiet: true });
import { Client } from "pg";
import { randomUUID, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { validateTestDatabaseUrl } from "../src/server/config";
async function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const child = spawn(command, args, { env, stdio: "inherit", shell: false });
  return new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
}
async function main() {
  const url = validateTestDatabaseUrl(
    process.env.TEST_DATABASE_URL || "",
    process.env.DATABASE_URL,
  );
  const schema = "wapala_test_" + randomUUID().replaceAll("-", "");
  const client = new Client({
    connectionString: url.toString(),
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    url.searchParams.set("schema", schema);
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: url.toString(),
      APP_URL: "http://127.0.0.1:3107",
      NODE_ENV: "test",
      WAPALA_MODE: "backend",
      EMAIL_MODE: "sink",
      SECURITY_KEY: randomBytes(32).toString("base64"),
    };
    const prisma = "node_modules/prisma/build/index.js";
    if (await run(process.execPath, [prisma, "migrate", "deploy"], env))
      throw new Error("Migration test gagal.");
    const result = await run(
      process.execPath,
      [
        "--conditions=react-server",
        "--import",
        "tsx",
        "--test",
        "--test-concurrency=1",
        "tests/backend/integration/*.test.ts",
      ],
      env,
    );
    process.exitCode = result;
  } finally {
    if (!/^wapala_test_[a-f0-9]{32}$/.test(schema))
      throw new Error("Schema cleanup tidak aman.");
    await client.query(`DROP SCHEMA "${schema}" CASCADE`);
    await client.end();
  }
}
main().catch(() => {
  console.error(
    "Tes integrasi gagal. Periksa PostgreSQL dan TEST_DATABASE_URL terisolasi; secrets tidak ditampilkan.",
  );
  process.exitCode = 1;
});
