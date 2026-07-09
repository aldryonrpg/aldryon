import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { SQL } from "bun";

const MIGRATION_PATH = join(
  import.meta.dir,
  "../../../src/infrastructure/persistence/migrations/0001_create_users.sql",
);

export interface PostgresEnvironment {
  connectionUri: string;
  stop(): Promise<void>;
}

/**
 * apps/api talks to Postgres directly (see .claude/plan1.md §4 — it's a
 * trusted backend, so it skips PostgREST/RLS entirely), so integration tests
 * only need a real Postgres container, not a full Supabase-alike stack.
 *
 * Windows + Podman: Bun can't reach Podman's named pipe directly (see
 * apps/api/scripts/podman-pipe-relay.ts for why). Run that script once in
 * its own terminal, then set DOCKER_HOST to the port it prints before
 * running these tests. Not needed on Linux/macOS/CI.
 */
export async function startPostgresEnvironment(): Promise<PostgresEnvironment> {
  if (process.platform === "win32" && !process.env.DOCKER_HOST) {
    throw new Error(
      "DOCKER_HOST is not set. On Windows + Podman, run " +
        "`bun run apps/api/scripts/podman-pipe-relay.ts` in another terminal first, " +
        "then set DOCKER_HOST to the port it prints.",
    );
  }

  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("aldryon_test")
    .withUsername("aldryon")
    .withPassword("aldryon")
    .start();

  const connectionUri = container.getConnectionUri();

  const sql = new SQL(connectionUri);
  try {
    await sql.unsafe(readFileSync(MIGRATION_PATH, "utf-8"));
  } finally {
    await sql.close();
  }

  return {
    connectionUri,
    async stop() {
      await container.stop();
    },
  };
}
