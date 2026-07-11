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

You need **[Bun](https://bun.sh/)**. There is **no local Postgres** — the app
always talks to a real **Supabase** project for data, both locally and in
production (Docker/Podman is only needed for the container path below and
for integration tests, not for a database).

```bash
bun install
bun run dev:api    # back-end on http://localhost:3001
bun run dev:web    # front-end on http://localhost:3000
```

### Environment variables

Create **`apps/api/.env`** (gitignored):

```bash
# Direct Postgres connection — your Supabase project's connection string
# (Project Settings > Database > Connection string). Use the Session
# pooler string if the direct db.<ref>.supabase.co host isn't reachable
# (it's IPv6-only on many networks).
DATABASE_URL=postgresql://postgres:<password>@<host>:5432/postgres
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

### Running via Docker (matches Render)

`bun run docker:up` builds and starts **both** apps from the same
Dockerfiles Render deploys (`apps/api/Dockerfile`, `apps/web/Dockerfile`) via
the repo-root `docker-compose.yml` — api on `:3001`, web on `:3000`. Both
read their env vars from the files above (`api` via `env_file`; `web`'s
`NEXT_PUBLIC_*` are baked in at **build time**, since Next.js inlines them
client-side — that's why the script passes
`--env-file apps/web/.env.local`).

| Script              | What it does                          |
| ------------------- | -------------------------------------- |
| `bun run docker:up`   | Build + start both containers          |
| `bun run docker:down` | Stop them                              |
| `bun run docker:logs` | Tail both containers' logs             |

Uses **`podman compose`** (Podman is the assumed local runtime — start the
machine first: `podman machine start`). On **Docker Desktop**, run the same
`docker compose …` commands directly, or edit the scripts.

### Migrations

**`supabase/migrations/*.sql`** is the one canonical migrations folder —
see the `push-supabase-migrations` Claude Code skill (or
`scripts/push-supabase-migrations.ts` directly) for adding and pushing a new
one to the real Supabase project:

```bash
bun run db:push:supabase:dry-run   # preview what would push
bun run db:push:supabase           # actually push
```

### Tests

```bash
bun run test:api                    # unit + integration
bun run test:api:unit               # unit only
bun run test:api:integration:coverage   # integration + usecase coverage gate
```

Integration tests spin up their **own ephemeral Postgres via
testcontainers** — a throwaway container, unrelated to Supabase and to the
`docker:up` app containers above; it exists only for the duration of the
test run and reads its schema straight from `supabase/migrations/`.

> **Windows + Podman:** compose connects to the Podman machine's Docker-API
> named pipe. If a stale `DOCKER_HOST` is exported (e.g. a dead
> testcontainers relay port), compose can't connect — run
> `unset DOCKER_HOST`, or set it to `npipe:////./pipe/docker_engine`.
