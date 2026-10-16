import "server-only";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getConfig } from "./config";
const databaseGlobal = globalThis as unknown as { wapalaDb?: PrismaClient };
export function getDb(): PrismaClient {
  if (!databaseGlobal.wapalaDb) {
    const databaseUrl = getConfig().databaseUrl;
    const schema = new URL(databaseUrl).searchParams.get("schema") || "public";
    if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(schema)) throw new Error("Invalid database schema");
    const adapter = new PrismaPg(
      {
        connectionString: databaseUrl,
        max: 5,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        statement_timeout: 10000,
        options: `-c search_path=${schema}`,
      },
      { schema },
    );
    databaseGlobal.wapalaDb = new PrismaClient({ adapter });
  }
  return databaseGlobal.wapalaDb;
}
