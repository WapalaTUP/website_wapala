import { mkdir, readFile, writeFile, realpath, readdir } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { resolve, join, isAbsolute, relative, dirname, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

function databaseEnvironment(value) {
  const url = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.hash ||
    [...url.searchParams].some(([key, val]) => key !== "schema" || val !== "public") ||
    !/^\/[a-zA-Z0-9_]+$/.test(url.pathname)
  )
    throw new Error("Invalid database connection");
  return {
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGDATABASE: url.pathname.slice(1),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
  };
}
export function stagingDatabase(target, production) {
  try {
    const stage = databaseEnvironment(target),
      prod = databaseEnvironment(production);
    if (
      !target ||
      !production ||
      new URL(target).search ||
      !["127.0.0.1", "localhost", "[::1]"].includes(stage.PGHOST) ||
      !/^[a-zA-Z0-9_]+_restore_test$/.test(stage.PGDATABASE) ||
      stage.PGDATABASE.toLowerCase() === prod.PGDATABASE.toLowerCase()
    )
      throw new Error();
    return stage;
  } catch {
    throw new Error("Unsafe staging database: use a distinct local name ending _restore_test");
  }
}
function run(command, args, connection, capture = false) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("PG")),
  );
  return new Promise((accept, reject) => {
    const child = spawn(command, args, {
      env: { ...env, ...connection },
      shell: false,
      stdio: ["ignore", capture ? "pipe" : "ignore", "ignore"],
    });
    let output = "";
    child.stdout?.on("data", (data) => {
      output += data;
    });
    child.on("error", () => reject(new Error(`${command} unavailable`)));
    child.on("exit", (code) =>
      code === 0 ? accept(output) : reject(new Error(`${command} failed (details suppressed)`)),
    );
  });
}
async function fileHash(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
async function rejectMediaLinks(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || (!entry.isFile() && !entry.isDirectory()))
      throw new Error("Media backup refuses links and special files");
    if (entry.isDirectory()) await rejectMediaLinks(join(folder, entry.name));
  }
}
async function backup(destination) {
  if (process.env.WAPALA_WRITERS_STOPPED !== "yes")
    throw new Error(
      "Stop app, email worker and cleanup jobs; set WAPALA_WRITERS_STOPPED=yes only after verifying",
    );
  if (!isAbsolute(destination) || !process.env.MEDIA_ROOT || !isAbsolute(process.env.MEDIA_ROOT))
    throw new Error("Use explicit absolute backup and private media paths");
  const media = await realpath(process.env.MEDIA_ROOT),
    dest = join(await realpath(dirname(resolve(destination))), basename(destination));
  const fromMedia = relative(media, dest);
  if (
    !fromMedia ||
    (!fromMedia.startsWith("..") && !isAbsolute(fromMedia)) ||
    dest === resolve("/")
  )
    throw new Error("Backup destination cannot be within media storage");
  await rejectMediaLinks(media);
  await mkdir(dest, { mode: 0o700 }); // No recursive or existing destination reuse.
  await run(
    "pg_dump",
    ["--format=custom", "--no-owner", "--no-acl", "--file", join(dest, "database.dump")],
    databaseEnvironment(process.env.DATABASE_URL),
  );
  await run("tar", ["-czf", join(dest, "media.tar.gz"), "-C", media, "."], {});
  const checksums = {};
  for (const name of ["database.dump", "media.tar.gz"])
    checksums[name] = await fileHash(join(dest, name));
  await writeFile(
    join(dest, "manifest.json"),
    JSON.stringify({ version: 1, createdAt: new Date().toISOString(), checksums }, null, 2),
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Backup complete. Encrypt and copy off-host; retain SECURITY_KEY separately in the approved secrets store.",
  );
}
async function restoreStage(source) {
  const connection = stagingDatabase(process.env.RESTORE_DATABASE_URL, process.env.DATABASE_URL);
  const folder = await realpath(source),
    manifest = JSON.parse(await readFile(join(folder, "manifest.json"), "utf8"));
  if (manifest.version !== 1) throw new Error("Unsupported backup manifest");
  for (const name of ["database.dump", "media.tar.gz"])
    if ((await fileHash(join(folder, name))) !== manifest.checksums?.[name])
      throw new Error("Backup checksum mismatch");
  const listing = await run("tar", ["-tzf", join(folder, "media.tar.gz")], {}, true);
  if (
    listing
      .split("\n")
      .filter(Boolean)
      .some((name) => !name.startsWith("./") || name.split("/").includes(".."))
  )
    throw new Error("Unsafe media archive paths");
  const types = await run("tar", ["-tvzf", join(folder, "media.tar.gz")], {}, true);
  if (
    types
      .split("\n")
      .filter(Boolean)
      .some((line) => !["-", "d"].includes(line[0]))
  )
    throw new Error("Media restore refuses links and special files");
  // This drill never targets or replaces the production media root/database.
  const drillRoot = "/var/lib/wapala/restore-drills";
  if ((await realpath(drillRoot)) !== drillRoot)
    throw new Error("Restore drill root must not be a symlink");
  const drill = join(drillRoot, new Date().toISOString().replace(/[:.]/g, "-") + "-" + process.pid);
  await mkdir(drill, { mode: 0o700 });
  await run("createdb", ["--maintenance-db=postgres", connection.PGDATABASE], connection); // Existing DB fails; never drop or reuse.
  await run(
    "pg_restore",
    [
      "--exit-on-error",
      "--no-owner",
      "--no-acl",
      "--dbname",
      connection.PGDATABASE,
      join(folder, "database.dump"),
    ],
    connection,
  );
  await run(
    "tar",
    ["-xzf", join(folder, "media.tar.gz"), "--no-same-owner", "--no-same-permissions", "-C", drill],
    {},
  );
  await run(
    "psql",
    [
      "--no-psqlrc",
      "--set=ON_ERROR_STOP=1",
      "--command",
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'",
    ],
    connection,
  );
  console.log(
    `Staging restore completed in ${drill}. Validate record counts, authorized media and integrity before a separately approved production recovery.`,
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, folder] = process.argv.slice(2);
  process.umask(0o077);
  try {
    if (command === "backup" && folder) await backup(folder);
    else if (command === "restore-stage" && folder) await restoreStage(folder);
    else
      throw new Error(
        "Usage: node scripts/release-backup.mjs backup NEW_ABSOLUTE_DIRECTORY | restore-stage BACKUP_DIRECTORY",
      );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
