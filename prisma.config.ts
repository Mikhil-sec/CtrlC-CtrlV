import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Read directly rather than through Prisma's `env()` helper, which throws at
 * config load when the variable is missing.
 *
 * Only the migration commands need a connection string. `prisma generate` does
 * not, and it runs on `npm install` and in CI, where there is no database and
 * no reason for one. Failing there would mean a fresh clone could not install
 * until someone had provisioned Postgres.
 *
 * A migration against an empty string still fails, with a message about not
 * reaching the database, which is the right error to get.
 */
const databaseUrl = process.env.DATABASE_URL ?? "";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
  },
});
