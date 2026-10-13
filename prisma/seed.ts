import "dotenv/config";
import { config } from "dotenv";
import { seedFoundation } from "../src/server/foundation-seed";
import { getDb } from "../src/server/db";
if (process.env.NODE_ENV !== "production")
  config({ path: ".local/backend.env", quiet: true });
seedFoundation()
  .then(() =>
    console.log("Seed struktur minimal selesai; tidak ada akun/data demo."),
  )
  .catch(() => {
    console.error("Seed gagal; periksa konfigurasi server.");
    process.exitCode = 1;
  })
  .finally(() => getDb().$disconnect());
