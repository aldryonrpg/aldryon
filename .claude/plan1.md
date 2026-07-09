# Plan 1 — Aldryon Monorepo Bootstrap

> Aldryon — A Text Based RPG.
> This plan describes the initial architecture and delivery setup for the project.

## 1. Goal

Stand up a **monorepo** containing two deployable applications:

1. **`apps/web`** — Next.js front-end
   - Serves the game UI and static assets.
   - Handles **Google login** (initiates the OAuth flow); all auth/session
     verification calls are proxied to the back-end.
   - Talks to the back-end over HTTP (no direct DB access).

2. **`apps/api`** — Bun back-end
   - Connects to **Supabase** for the database and for **Google auth**
     (Supabase Auth with the Google provider).
   - Built with **Clean Architecture + DDD**.
   - Exposes the API consumed by the web app.

Both apps are **deployed on Render** as separate services.

## 2. Repository Layout

```
aldryon/
├── apps/
│   ├── web/                 # Next.js front-end
│   │   ├── app/             # App Router
│   │   ├── public/          # assets (papiro.png, etc.)
│   │   └── package.json
│   ├── api/                 # Bun back-end (Clean Arch + DDD)
│   │   ├── src/
│   │   │   ├── domain/          # entities, value objects, domain services (no deps)
│   │   │   ├── usecase/         # application use cases  ← 75% coverage gate (integration)
│   │   │   ├── infrastructure/  # supabase client, repositories, HTTP, adapters
│   │   │   └── interface/       # controllers / route handlers / DTOs
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   └── integration/     # testcontainers-based (measures usecase coverage)
│   │   └── package.json
│   └── shared/
│       └── dtos/            # shared request/response contracts (web ↔ api)
├── .claude/
│   └── plan1.md             # this file
├── CLAUDE.md                # project rules (see §7)
├── AGENTS.md                # points to CLAUDE.md
├── render.yaml              # Render blueprint for both services
└── package.json             # workspace root (Bun workspaces)
```

Use **Bun workspaces** at the root so everything under `apps/*` (including
`apps/shared`) is managed together.

## 3. Front-end — `apps/web` (Next.js)

- Scaffold with Next.js (App Router, TypeScript).
- **Login page (`/login`):**
  - Uses **`papiro.png`** as the page background — a **portrait** blank
    parchment scroll on a **solid black canvas** (~1024×1536, not transparent).
    Render it centered on the black backdrop (don't stretch/`cover`-crop it).
  - Renders a **"Sign in with Google" button at the bottom** of the page.
  - On successful login, the user is routed to the **main page (`/`)**.
- **Main page (`/`):**
  - Shows **`mapa.png`** — a **landscape ornate metal-framed parchment scroll**
    (~1024×480) with a **transparent background**. It is a blank **frame /
    container** (not an actual rendered map); future map/game content will be
    drawn inside it. Empty for now — a placeholder we'll evolve later.
  - Because `mapa.png` is transparent, give the page its own backdrop behind it
    (e.g. the same dark canvas).
  - Protected: an unauthenticated visitor to `/` is redirected to `/login`.
- **Google login flow:**
  - The Google login button starts the OAuth flow.
  - The front-end **does not verify tokens itself** — it forwards the
    Supabase/Google session to `apps/api`, which validates it and returns
    the app session / user profile.
  - After the back-end confirms the session, redirect to `/`.
- Store static game assets under `apps/web/public/` (move `papiro.png` and
  `mapa.png` — both currently at the repo root — here).
- Configure the API base URL via an env var (`NEXT_PUBLIC_API_URL`).

## 4. Back-end — `apps/api` (Bun) — Clean Architecture + DDD

Dependency rule (inward only): `interface → usecase → domain`; `infrastructure`
implements interfaces defined by inner layers.

- **domain/** — pure business model. No framework, no Supabase, no I/O.
- **usecase/** — orchestrates domain to fulfill application actions. Depends on
  repository *interfaces*, not concrete implementations. **This is the folder
  under the 75% coverage gate.**
- **infrastructure/** — Supabase client, repository implementations, Google auth
  verification, HTTP server wiring.
- **interface/** — route handlers / controllers, request/response DTOs, mapping.

**Supabase — data access goes direct to Postgres, not through PostgREST:**

- **Google auth** verification uses `supabase-js`'s `auth.getUser(token)` against
  Supabase Auth (GoTrue) — see `SupabaseAuthGateway`. That's a real external
  service and stays as-is.
- **Data access does NOT go through `supabase-js .from()` (PostgREST).**
  apps/api is a trusted backend using the **service role key**, which already
  bypasses Row Level Security — PostgREST's entire reason to exist. Routing
  our own server through PostgREST would add a network hop and a dependency
  for zero benefit. Instead, `PostgresUserRepository` connects **directly to
  Postgres** using Bun's native `SQL` client (`Bun.SQL` / `import { SQL } from
  "bun"`) against `DATABASE_URL` (Supabase's direct connection string).
    - *This was PostgREST-based in an earlier iteration of this plan; changed
      after review — see "Findings" below for why.*
- Keep both the Supabase Auth client and the Postgres client confined to
  `infrastructure/` behind interfaces (`AuthGateway`, `UserRepository`).
- Integration tests use a **plain testcontainers Postgres** (no PostgREST, no
  Supabase project) — see "Findings" below for why this got much simpler.

## 3a. Shared Contracts — `apps/shared/dtos`

- Request/response contracts shared between `apps/web` and `apps/api` live in
  **`apps/shared/dtos`** as a workspace package.
- Both apps import DTOs from here — no duplicated contract definitions.
- Keep it pure types/schemas (no runtime framework deps) so both a Next.js and a
  Bun runtime can consume it.

## 4a. Linting — Biome (all apps)

- **Biome** is the single linter + formatter for the whole repo — both
  `apps/web` (Next.js) and `apps/api` (Bun).
- Configure a shared root `biome.json` (with per-app overrides only where
  needed). No ESLint/Prettier.

## 4b. User Schema

`users` table / domain `User` fields, beyond the auth basics (`id`,
`external_auth_id`, `email`, `display_name`, `avatar_url`):

- **`id` is a UUIDv7**, generated in application code (usecase layer) via
  `Bun.randomUUIDv7()` — not a Postgres `DEFAULT`, since Postgres 16 has no
  native `uuidv7()` and id generation belongs to the domain, not the DB.
- **`username`** — string, **max 40 alphanumeric characters**
  (`^[A-Za-z0-9]{1,40}$`), enforced in both `User.create()` (domain) and a DB
  `CHECK` constraint. **Nullable** — Google gives no username, so it starts
  `null` on first login and is set later via a "choose username" flow that
  doesn't exist yet. *Open question: should it be unique? Not decided —
  flagging rather than assuming, since the conflict-handling UX isn't defined
  yet.*
- **`is_vip` / `isVip`** — boolean, **not null, defaults to `false`**. Both
  the domain type and the DB column are non-nullable.
- **Preservation rule:** `username` and `isVip` are player-owned profile
  state, not Google/Supabase auth claims. `AuthenticateUserUseCase` carries
  them forward from the existing record on every login instead of resetting
  them — only `email`/`displayName`/`avatarUrl` re-sync from the identity
  provider each time.

## 4c. Findings — Windows + Podman local dev

Discovered while first running the integration suite locally against Podman:

- **Bun's `node:http` client cannot reach Windows named pipes.** A raw
  `net.connect()` to Podman's pipe (`\\.\pipe\podman-machine-default`) works
  fine, but dockerode's HTTP-over-`socketPath` calls (used by testcontainers)
  fail with a generic `"Was there a typo in the url or port?"` — this is a
  Bun-on-Windows gap, not a Podman or testcontainers problem.
- **Tried auto-spawning the relay per test run — reverted.** A first attempt
  auto-detected Windows + Podman and transparently spun up a TCP↔named-pipe
  relay (in-process, then as a per-run spawned child process) so `bun test`
  would "just work" with zero setup. Both versions broke in ways that ate a
  lot of debugging time: the in-process relay stalled specifically once
  Postgres started continuously streaming logs over one relayed connection
  while testcontainers needed other Docker API calls concurrently (confirmed
  by isolating it — plain `GenericContainer` start/stop worked fine over the
  *same* relay, only `PostgreSqlContainer` hung); the spawned-child version
  then hit an unresolved CPU-spin bug (one relay process pegged ~100% CPU for
  6+ minutes with no forward progress). Root cause not fully nailed down for
  either — diminishing returns, so this was abandoned rather than chased
  further.
- **What actually works, reliably:** a **single, manually-started, long-lived
  relay process** — `bun run apps/api/scripts/podman-pipe-relay.ts`, run once
  in its own terminal — with `DOCKER_HOST` pointed at the port it prints in
  the terminal running the tests. This is the exact shape of the very first
  thing that worked when this was diagnosed by hand, before any "make it
  automatic" attempts. `startPostgresEnvironment()` just checks `DOCKER_HOST`
  is set on Windows and throws a clear, actionable error pointing at the
  script if it isn't — no magic, easy to reason about when it breaks.
- **Dropping PostgREST from the persistence design (§4) independently fixed
  most of the pain anyway** — the old PostgREST-based harness needed a Docker
  `Network` + Postgres + PostgREST containers + an extra REST-path proxy, all
  through the same relay; going direct-to-Postgres removed 3 of those 4
  moving parts and was likely most of why the *final*, simple Postgres-only
  setup is stable enough for the manual-relay approach to just work.
- **Practical consequence:** on Windows + Podman, running the integration
  suite (and therefore a pre-commit that touches `apps/api`) requires one
  manual one-time step per dev session (`bun run
  apps/api/scripts/podman-pipe-relay.ts` in a separate terminal + setting
  `DOCKER_HOST`). Not needed on Linux/macOS or in CI (GitHub Actions runners
  have a real Docker socket, so this whole file is a no-op there).

## 5. Testing Strategy (`apps/api`)

- **Unit tests** (`tests/unit/`): pure domain + usecase logic, fast, no I/O.
- **Integration tests** (`tests/integration/`): use **testcontainers** to spin
  up a real Postgres (and any other needed service) container.
  - Cover the **happy path** plus key **edge cases**.
- **Coverage gate:** **≥ 75% coverage on the `usecase/` folder, measured from
  the integration test run only** (not unit tests). Coverage is scoped to
  `src/usecase/**` — other folders don't count toward the threshold.
- Use Bun's built-in test runner (`bun test`) with coverage, scoping the
  coverage report to `src/usecase/**` for the integration suite.

## 6. Pre-commit & Quality Gates (`apps/api`)

A commit that touches the back-end must not pass unless **all** of the
following succeed:

1. **Linter** passes (e.g. ESLint / Biome).
2. **Unit tests** pass.
3. **Integration tests** (testcontainers) pass.
4. **`usecase/` coverage ≥ 75%.**

Implementation:
- Use **husky + lint-staged** as the git hook manager (most widely used in the
  JS/TS ecosystem).
- The hook runs **Biome** → unit tests → integration tests (which also produce
  the **`usecase/` coverage** check).
- Mirror the same gates in CI so they can't be bypassed with `--no-verify`.

> **Local environment assumption:** every developer has a **Docker or Podman**
> runtime available locally. testcontainers integration tests therefore run in
> pre-commit as well as CI — no need to gate them to CI only.

## 6a. CI Pipeline — Back-end (`apps/api`)

Stages, in order. **Every stage is required and blocks the pipeline on failure,
EXCEPT the integration-test stage, which is optional (allowed to fail without
failing the pipeline).**

1. **Biome linter** — lint + format check. *(required)*
2. **Vulnerability check** — **Trivy** (open-source, broadest coverage:
   language deps, OS packages, IaC/misconfig, secrets, licenses). Fails the
   build on known vulnerabilities. *(required)*
3. **Unit tests** — `bun test`. *(required)*
4. **Integration tests** — testcontainers-based; **also produces the
   `usecase/` ≥ 75% coverage report** (coverage is measured here, not in the
   unit stage). Requires a Docker/Podman-capable runner. *(optional — does not
   block the pipeline)*
5. **Deploy on Render** — runs after all required stages pass.

> **Note on the coverage gate:** the 75% `usecase/` coverage is derived from the
> **integration** run, which is the *optional* CI stage — so in CI a coverage
> shortfall is advisory, not blocking. It is enforced hard in **pre-commit**,
> where integration tests always run. If you want CI to hard-block on coverage
> too, promote the coverage assertion (or the whole integration stage) to
> required.

## 7. Rules Documentation

Create **`CLAUDE.md`** (primary) and **`AGENTS.md`** (pointer) at the repo root
capturing the non-negotiable rules so every session/instance follows them:

- Monorepo with `apps/web` (Next.js) and `apps/api` (Bun).
- Back-end uses **Clean Architecture + DDD**.
- Back-end pre-commit must pass **lint + unit tests + integration tests**.
- **testcontainers** for integration (happy path + edge cases).
- **≥ 75% coverage on `usecase/`.**
- Both apps deploy on **Render**.
- Supabase for DB + Google auth; front-end proxies auth to the back-end.

## 8. Deployment — Render

- Add `render.yaml` (Render Blueprint) defining two services:
  - `aldryon-web` — Next.js (Node runtime).
  - `aldryon-api` — Bun service.
- Configure env vars per service (Supabase keys, Google OAuth creds,
  `NEXT_PUBLIC_API_URL`, etc.) as Render secrets — never commit them.

## 9. Implementation Order

1. Root Bun workspace + repo layout + move `papiro.png` into `apps/web/public/`.
2. `CLAUDE.md` + `AGENTS.md` with the rules (§7).
3. Root **Biome** config (`biome.json`).
4. `apps/shared/dtos` workspace package (initial contract types).
5. `apps/api` skeleton (domain/usecase/infrastructure/interface) + Bun test setup.
6. Pre-commit hooks via **husky + lint-staged** (Biome + unit + integration +
   usecase coverage gate).
7. testcontainers integration harness (Postgres) + first happy-path test, with
   coverage scoped to `src/usecase/**`.
8. Supabase wiring (DB + Google auth verification) in `infrastructure/`.
9. `apps/web` Next.js scaffold:
   - Login page (`/login`) with `papiro.png` background + Google login button at
     the bottom → login proxied to `apps/api`, importing from `apps/shared/dtos`.
   - Main page (`/`) showing `mapa.png`, protected (redirect to `/login` if
     unauthenticated); redirected to after successful login.
10. Back-end CI pipeline (§6a): Biome → Trivy → `bun test` → optional
    integration → Render deploy.
11. `render.yaml` blueprint for both services.

## 10. Decisions & Open Questions

**Decided:**
- Linter/formatter: **Biome**, for both back-end and front-end.
- Local dev assumes a **Docker or Podman** runtime is always available →
  integration tests run in pre-commit and CI.
- Back-end unit tests run via **`bun test`**.
- **`usecase/` ≥ 75% coverage is measured from the integration run only**,
  scoped to `src/usecase/**`.
- Back-end CI stages: **Biome → Trivy vuln check → `bun test` unit tests →
  optional testcontainers integration (produces coverage) → deploy on Render**
  (see §6a). All stages required and blocking except the integration stage.
- Vulnerability scanner: **Trivy** (broadest open-source coverage).
- Hook manager: **husky + lint-staged** (most commonly used).
- Shared contracts live in **`apps/shared/dtos`** (workspace package).

**Open:**
- Nothing outstanding — ready to move to implementation.
