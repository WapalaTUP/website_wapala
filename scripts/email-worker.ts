import "dotenv/config";
import { config } from "dotenv";
import { createMailTransport } from "../src/server/email/transport";
import { deliverOutbox } from "../src/server/email/worker";
import { getDb } from "../src/server/db";
if (process.env.NODE_ENV !== "production")
  config({ path: ".local/backend.env", quiet: true });
deliverOutbox(createMailTransport())
  .then((result) => console.log(result))
  .catch(() => {
    console.error("Worker email gagal; detail sensitif tidak ditampilkan.");
    process.exitCode = 1;
  })
  .finally(() => getDb().$disconnect());
