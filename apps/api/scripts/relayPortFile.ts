import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Where podman-pipe-relay.ts advertises its DOCKER_HOST URI so test runs
 * (integration tests, pre-commit hook) can find the relay without every
 * shell having to export DOCKER_HOST manually. Shared between the relay
 * script and tests/integration/support/postgresEnvironment.ts.
 */
export const RELAY_PORT_FILE = join(tmpdir(), "aldryon-podman-relay-docker-host.txt");
