import "dotenv/config";
import { config } from "dotenv";
if (process.env.NODE_ENV !== "production")
  config({ path: ".local/backend.env", quiet: true });
import { defineConfig } from "prisma/config";
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },
  datasource: { url: process.env.DATABASE_URL },
});
