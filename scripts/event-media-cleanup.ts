import { config } from "dotenv";
config({ path: [".env.local", ".env", ".local/backend.env"], quiet: true });
import { getDb } from "../src/server/db";
import { cleanupEventUploads } from "../src/server/media/event-upload";
async function main() {
  try {
    console.log(
      JSON.stringify({
        removedExpiredUnboundEventUploads: await cleanupEventUploads(),
      }),
    );
  } catch {
    console.error(
      "Pembersihan upload Event gagal. Tidak menargetkan berkas peserta yang terikat.",
    );
    process.exitCode = 1;
  } finally {
    await getDb().$disconnect();
  }
}
main();
