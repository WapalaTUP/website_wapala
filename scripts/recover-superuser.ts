import "dotenv/config";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { assertInteractive, hiddenPassword } from "./terminal-password";
import { recoverSuperuser } from "../src/server/auth/recovery";
import { getDb } from "../src/server/db";
if (process.env.NODE_ENV !== "production")
  config({ path: ".local/backend.env", quiet: true });
async function main() {
  assertInteractive(
    process.argv.slice(2),
    !!process.stdin.isTTY && !!process.stdout.isTTY,
  );
  console.log(
    "Pemulihan khusus akun superuser@wapala.org. Semua sesi akan dicabut.",
  );
  const password = await hiddenPassword("Password baru: "),
    confirmation = await hiddenPassword("Ulangi password: ");
  if (password !== confirmation) throw new Error("Konfirmasi tidak sesuai.");
  await recoverSuperuser(password, {
    ipDigest: "server-operator",
    userAgent: "recovery-cli",
    requestId: randomUUID(),
  });
  console.log("Akses dipulihkan. Silakan login kembali.");
}
main()
  .catch(() => {
    console.error(
      "Pemulihan dibatalkan atau gagal; tidak ada password yang ditampilkan.",
    );
    process.exitCode = 1;
  })
  .finally(() => getDb().$disconnect());
