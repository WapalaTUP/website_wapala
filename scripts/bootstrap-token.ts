import "dotenv/config";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { createBootstrapToken } from "../src/server/auth/bootstrap";
import { getDb } from "../src/server/db";
if (process.env.NODE_ENV !== "production")
  config({ path: ".local/backend.env", quiet: true });
if (process.argv.length > 2)
  throw new Error("Tidak menerima argumen credential.");
createBootstrapToken({
  ipDigest: "server-operator",
  userAgent: "bootstrap-cli",
  requestId: randomUUID(),
})
  .then((result) => {
    console.log("Token instalasi (sekali tampil, berlaku 30 menit):");
    console.log(result.token);
  })
  .catch(() => {
    console.error("Token tidak dapat dibuat; setup mungkin sudah ditutup.");
    process.exitCode = 1;
  })
  .finally(() => getDb().$disconnect());
