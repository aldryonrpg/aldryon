# Aldryon — A Text Based RPG

Aldryon is a text-based RPG built as a monorepo with a web front-end and an
API back-end.

## Gameplay

You fight monsters in turn-based battles. Both you and the monster have
**attributes**, which determine how much damage each attack deals. You also
have **HP** (health) and **Stamina** — attacks cost Stamina to perform.

On your turn, you choose one of:

- **Attack** — fight the monster, spending Stamina and dealing damage based
  on attributes.
- **Rest** — recover Stamina.
- **Bag** — use an item.
- **Run** — try to flee the battle; there's a chance the monster gets a free
  attack on you as you do.

Killing a monster grants **XP**. Enough XP levels you up, increasing your
attributes. The core risk: **if you die, you lose 1% of your XP.**

## Tech stack

- **Front-end** (`apps/web`) — [Next.js](https://nextjs.org/) (TypeScript),
  handles the UI and starts Google login via
  [Supabase Auth](https://supabase.com/auth).
- **Back-end** (`apps/api`) — [Bun](https://bun.sh/), built with
  **Clean Architecture + DDD** (`domain` → `usecase` → `interface`, with
  `infrastructure` implementing the boundaries). Verifies Google login via
  Supabase Auth and talks to **Postgres** (Supabase-hosted) directly.
- **Database & Auth** — [Supabase](https://supabase.com/) (Postgres + Google
  OAuth).
- **Shared contracts** (`apps/shared/dtos`) — Zod schemas shared between web
  and api.
- **Tooling** — [Biome](https://biomejs.dev/) (lint + format), husky +
  lint-staged (pre-commit), [testcontainers](https://testcontainers.com/)
  (integration tests), [Trivy](https://trivy.dev/) (vulnerability scanning).
- **CI/CD** — GitHub Actions, deployed on [Render](https://render.com/).

## Running locally

You need **[Bun](https://bun.sh/)** and a **Docker or Podman** runtime.

```bash
bun install
bun run db:up      # start local Postgres via docker-compose (see below)
bun run dev:api    # back-end on http://localhost:3001
bun run dev:web    # front-end on http://localhost:3000
```

### Local database (docker-compose)

The repo-root **`docker-compose.yml`** runs `postgres:16-alpine` and mounts
`apps/api/src/infrastructure/persistence/migrations/` into the container's
init directory, so **every numbered `*.sql` migration is applied in order on
first boot** — a fresh DB comes up already migrated.

The `db:*` scripts use **`podman compose`** (Podman is the assumed local
runtime). On **Docker Desktop**, run the same `docker compose …` commands
directly, or edit the scripts. With **Podman**, start the machine first:
`podman machine start`.

| Script            | What it does                                             |
| ----------------- | ------------------------------------------------------- |
| `bun run db:up`   | Start Postgres in the background                         |
| `bun run db:down` | Stop it (keeps the data volume)                         |
| `bun run db:reset`| Wipe the volume **and re-apply all migrations** — run this after adding a migration |
| `bun run db:logs` | Tail Postgres logs                                      |

The API talks to Postgres **directly** (it's a trusted service — see
[CLAUDE.md](CLAUDE.md)); auth still verifies Google tokens against a real
**Supabase** project, so Supabase keys are required even locally.

### Environment variables

Create **`apps/api/.env`** (gitignored):

```bash
# Direct Postgres connection — points at the docker-compose database.
DATABASE_URL=postgres://aldryon:aldryon@localhost:5432/aldryon
# Supabase Auth (GoTrue) — used only to verify Google login tokens.
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
# Optional: PORT (default 3001), WEB_ORIGIN (default http://localhost:3000)
```

Create **`apps/web/.env.local`** (gitignored):

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

### Tests

```bash
bun run test:api                    # unit + integration
bun run test:api:unit               # unit only
bun run test:api:integration:coverage   # integration + usecase coverage gate
```

Integration tests spin up their **own** throwaway Postgres via
testcontainers — they do **not** use the docker-compose database, so the two
never interfere.

> **Windows + Podman:** the compose provider connects to the Podman machine's
> Docker-API named pipe. If a stale `DOCKER_HOST` is exported (e.g. a dead
> testcontainers relay port), compose can't connect — run
> `unset DOCKER_HOST`, or set it to `npipe:////./pipe/docker_engine`.
