import { execFileSync } from "node:child_process";
import net from "node:net";

/**
 * Windows + Podman local dev only. Bun's node:http client can't make HTTP
 * requests over Windows named pipes (confirmed by hand: a raw net.connect to
 * the pipe works, but dockerode's HTTP-over-socketPath calls fail with "Was
 * there a typo in the url or port?"), so testcontainers can't reach Podman's
 * pipe directly on Windows. This relays it over plain TCP instead, which
 * Bun's HTTP client handles fine.
 *
 * Run this once in its own terminal, then in another terminal:
 *   DOCKER_HOST=tcp://127.0.0.1:<printed-port> bun run test:api:integration:coverage
 *
 * An earlier version of this spawned the relay automatically as a per-run
 * child process, but that hit an unresolved CPU-spin bug under load
 * (possibly retry contention between testcontainers and a freshly-spawned
 * relay) — a single long-lived relay you start yourself is simpler and
 * proven to work. Not needed on Linux/macOS/CI (real Docker daemons expose a
 * proper Unix socket, which Bun handles fine).
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
  console.log(`Relaying ${pipePath} -> tcp://127.0.0.1:${port}`);
  console.log(`Set DOCKER_HOST=tcp://127.0.0.1:${port} in the terminal running the tests.`);
});

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
