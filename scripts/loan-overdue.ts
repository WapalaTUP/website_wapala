import "dotenv/config";
import { config } from "dotenv";
import { markOverdueLoans } from "../src/server/domains/loan-overdue";
import { getDb } from "../src/server/db";
if (process.env.NODE_ENV !== "production")
  config({ path: ".local/backend.env", quiet: true });
markOverdueLoans()
  .then((result) => console.log(JSON.stringify(result)))
  .catch(() => {
    console.error(
      "Pembaruan keterlambatan gagal; detail sensitif tidak ditampilkan.",
    );
    process.exitCode = 1;
  })
  .finally(() => getDb().$disconnect());
