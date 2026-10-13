import { config } from "dotenv";
import { spawn } from "node:child_process";
config({
  path: [
    ".env.local",
    ".env",
    ".local/backend.env",
    ".local/scanner.env",
  ],
  quiet: true,
});
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    ...process.argv.slice(2),
  ],
  { env: process.env, stdio: "inherit", windowsHide: true },
);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
child.on("error", () => {
  console.error("Server development tidak dapat dimulai.");
  process.exitCode = 1;
});
