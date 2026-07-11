import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Pushes supabase/migrations/*.sql — the ONE canonical migrations source for
 * the whole project (also read directly by the testcontainers integration
 * harness, see apps/api/tests/integration/support/postgresEnvironment.ts) —
 * to the real Supabase Postgres project via `supabase db push --db-url`,
 * reading DATABASE_URL straight from apps/api/.env. No `supabase
 * login`/`link` (no OAuth device flow, no Supabase-account auth needed; the
 * connection string is all `db push` requires).
 *
 * To add a migration: `bunx supabase migration new <name>`, write the SQL
 * directly in the generated `supabase/migrations/<timestamp>_<name>.sql`,
 * then run this script. There's nothing to copy or keep in sync — every
 * consumer reads this one folder.
 *
 * Usage: bun run db:push:supabase [-- --dry-run]
 */

const ENV_PATH = join(import.meta.dir, "../apps/api/.env");

function readDatabaseUrl(): string {
  const line = readFileSync(ENV_PATH, "utf-8")
    .split("\n")
    .find((l) => l.startsWith("DATABASE_URL="));
  if (!line) {
    throw new Error(`DATABASE_URL not found in ${ENV_PATH}`);
  }
  return line.slice("DATABASE_URL=".length).trim();
}

const databaseUrl = readDatabaseUrl();
const extraArgs = process.argv.slice(2);

const proc = Bun.spawn(
  [
    "bunx",
    "supabase",
    "db",
    "push",
    "--db-url",
    databaseUrl,
    "--include-all",
    "--yes",
    ...extraArgs,
  ],
  { stdio: ["inherit", "inherit", "inherit"] },
);
process.exit(await proc.exited);
