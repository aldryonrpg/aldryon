import { spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { SQL } from "bun";
import { Wait } from "testcontainers";
import { RELAY_PORT_FILE } from "../../../scripts/relayPortFile";

// supabase/migrations/ is the ONE canonical migrations source (also what the
// Supabase CLI pushes to the real project — see
// .claude/skills/push-supabase-migrations). No mirrored/duplicate copy lives
// under apps/api; every consumer (this test harness, and Supabase itself)
// reads straight from here. Filenames are Supabase's required
// `<timestamp>_description.sql` format, which happens to sort correctly in
// plain lexical order — same reason `docker-entrypoint-initdb.d`-style
// runners work without any special-casing.
const MIGRATIONS_DIR = join(import.meta.dir, "../../../../../supabase/migrations");

export interface PostgresEnvironment {
  connectionUri: string;
  stop(): Promise<void>;
}

/**
 * apps/api talks to Postgres directly (see plans/plan1.md §4 — it's a
 * trusted backend, so it skips PostgREST/RLS entirely), so integration tests
 * only need a real Postgres container, not a full Supabase-alike stack.
 *
 * Windows + Podman: Bun can't reach Podman's named pipe directly (see
 * apps/api/scripts/podman-pipe-relay.ts for why). resolveDockerHost() below
 * finds a running relay via the temp file it advertises, or starts one
 * itself (detached, so later runs — e.g. the next pre-commit — reuse it).
 * A dev just commits; no terminals or env vars needed. Setting DOCKER_HOST
 * manually still overrides everything. Not needed on Linux/macOS/CI.
 */
export async function startPostgresEnvironment(): Promise<PostgresEnvironment> {
  if (process.platform === "win32") {
    process.env.DOCKER_HOST = await resolveDockerHost(process.env.DOCKER_HOST);
  }

  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("aldryon_test")
    .withUsername("aldryon")
    .withPassword("aldryon")
    // The module's default wait strategy is Wait.forAll([forHealthCheck(),
    // forListeningPorts()]). forListeningPorts' internal-port probe runs an
    // `exec` with a hijacked stream, which Bun's HTTP client never completes
    // (same class of bug as the named-pipe issue above), so the start hangs
    // until timeout. The pg_isready health check alone is sufficient — the
    // daemon runs it in-container, no API exec involved.
    .withWaitStrategy(Wait.forHealthCheck())
    .start();

  const connectionUri = container.getConnectionUri();

  const sql = new SQL(connectionUri);
  try {
    const migrationFiles = readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.endsWith(".sql"))
      .sort();
    for (const file of migrationFiles) {
      await sql.unsafe(readFileSync(join(MIGRATIONS_DIR, file), "utf-8"));
    }
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

/**
 * Finds a live podman-pipe-relay via the temp file it advertises on startup,
 * health-checking it (the file can outlive a crashed relay). When none is
 * reachable, starts one — detached, so it outlives this test run and the
 * next run reuses it instead of paying the startup cost again.
 *
 * An explicitly set DOCKER_HOST wins, but only after the same health check:
 * relay ports change across restarts, so a shell with an exported
 * DOCKER_HOST from last week silently points at a dead port — fall back to
 * discovery instead of failing every test instantly.
 */
async function resolveDockerHost(configured: string | undefined): Promise<string> {
  if (configured) {
    if (await isDockerHostAlive(configured)) return configured;
    console.warn(
      `DOCKER_HOST=${configured} is not responding (stale relay port from an old shell?) — ` +
        "ignoring it and discovering the relay instead.",
    );
  }

  const advertised = await readAdvertisedDockerHost();
  if (advertised) return advertised;

  const relayScript = join(import.meta.dir, "../../../scripts/podman-pipe-relay.ts");
  const relay = spawn(process.execPath, [relayScript], { detached: true, stdio: "ignore" });
  relay.unref();

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const dockerHost = await readAdvertisedDockerHost();
    if (dockerHost) return dockerHost;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    "Could not reach or auto-start the Podman pipe relay " +
      "(apps/api/scripts/podman-pipe-relay.ts). Is the Podman machine running? " +
      "(`podman machine start`) You can also run the relay in a terminal yourself " +
      "or set DOCKER_HOST directly.",
  );
}

/** The advertised relay URI, or undefined when the file or relay is dead. */
async function readAdvertisedDockerHost(): Promise<string | undefined> {
  let dockerHost: string;
  try {
    dockerHost = readFileSync(RELAY_PORT_FILE, "utf-8").trim();
  } catch {
    return undefined;
  }
  return (await isDockerHostAlive(dockerHost)) ? dockerHost : undefined;
}

async function isDockerHostAlive(dockerHost: string): Promise<boolean> {
  try {
    const ping = await fetch(`${dockerHost.replace("tcp://", "http://")}/_ping`, {
      signal: AbortSignal.timeout(2_000),
    });
    return ping.ok;
  } catch {
    return false;
  }
}
