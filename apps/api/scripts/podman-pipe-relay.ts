import { execFileSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import net from "node:net";
import { RELAY_PORT_FILE } from "./relayPortFile";

/**
 * Windows + Podman local dev only. Bun's node:http client can't make HTTP
 * requests over Windows named pipes (confirmed by hand: a raw net.connect to
 * the pipe works, but dockerode's HTTP-over-socketPath calls fail with "Was
 * there a typo in the url or port?"), so testcontainers can't reach Podman's
 * pipe directly on Windows. This relays it over plain TCP instead, which
 * Bun's HTTP client handles fine.
 *
 * Normally you never run this by hand: the integration test setup
 * (tests/integration/support/postgresEnvironment.ts) auto-starts it detached
 * when no live relay is advertised, and it keeps serving later runs. An old
 * per-run auto-spawn attempt hit a CPU-spin under load, but that was almost
 * certainly the Wait.forListeningPorts() exec hang (since fixed by waiting
 * on the health check instead), and a single long-lived relay avoids the
 * per-run churn anyway. Not needed on Linux/macOS/CI (real Docker daemons
 * expose a proper Unix socket, which Bun handles fine).
 */

const pipePath = resolvePodmanPipe();
if (!pipePath) {
  console.error(
    "Could not resolve the Podman machine's named pipe. Is `podman machine start` running?",
  );
  process.exit(1);
}

const server = net.createServer((client) => {
  const upstream = net.connect(pipePath);
  client.pipe(upstream);
  upstream.pipe(client);
  client.on("error", () => {});
  upstream.on("error", () => {});
});

server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  const port = address && typeof address === "object" ? address.port : undefined;
  const dockerHost = `tcp://127.0.0.1:${port}`;
  // Advertise the URI so test runs (and the pre-commit hook, which can't
  // easily be handed an env var) discover the relay automatically — see
  // resolveDockerHost() in tests/integration/support/postgresEnvironment.ts.
  writeFileSync(RELAY_PORT_FILE, dockerHost);
  console.log(`Relaying ${pipePath} -> ${dockerHost}`);
  console.log(`Advertised at ${RELAY_PORT_FILE}; tests pick it up automatically.`);
  console.log(`(Or set DOCKER_HOST=${dockerHost} manually.)`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    try {
      unlinkSync(RELAY_PORT_FILE);
    } catch {}
    process.exit(0);
  });
}

function resolvePodmanPipe(): string | undefined {
  try {
    const output = execFileSync(
      "podman",
      ["machine", "inspect", "--format", "{{.ConnectionInfo.PodmanPipe.Path}}"],
      { encoding: "utf-8" },
    ).trim();
    return output || undefined;
  } catch {
    return undefined;
  }
}
