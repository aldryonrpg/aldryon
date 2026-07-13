import { type PostgresEnvironment, startPostgresEnvironment } from "./postgresEnvironment";

let promise: Promise<PostgresEnvironment> | null = null;

/**
 * One testcontainers Postgres shared across every integration test file in
 * a run, instead of one per file. Spinning up N separate containers back
 * to back is slow and, on Windows + Podman, multiplies exposure to any
 * relay/container-start flakiness. Ryuk reaps this container when the test
 * process exits, so nothing needs to call `.stop()` on it explicitly —
 * doing so from one file's afterAll would break every file that runs after.
 */
export function getSharedPostgresEnvironment(): Promise<PostgresEnvironment> {
  if (!promise) {
    promise = startPostgresEnvironment();
  }
  return promise;
}
