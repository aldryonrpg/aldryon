# Aldryon — Project Rules

Aldryon is a text-based RPG. This repo is a **monorepo** with two deployable apps.
These rules are **non-negotiable** and apply to every instance/session working here.

## Agent working rules

- **NEVER commit or push anything.** Do not run `git commit`, `git push`, or any
  other command that writes to git history or a remote — under any
  circumstances. Leave changes in the working tree for the human to review and
  commit.
- **Every task runs the linter.** After making changes, run **Biome** to
  confirm the code is clean before considering the task done. Fix (or report)
  any lint/format issues you introduce.

## Architecture

- **Monorepo** (Bun workspaces) with:
  - `apps/web` — **Next.js** front-end. Serves the UI/assets and starts the
    **Google login** flow. All auth verification and data requests are proxied
    to the back-end; the front-end never talks to the database directly.
    - **Login page (`/login`)** uses **`papiro.png`** (a portrait parchment
      scroll on a solid black canvas) as the background, with a **"Sign in with
      Google" button at the bottom**.
    - **Main page (`/`)** shows **`mapa.png`** — a landscape, transparent,
      ornate-framed parchment scroll that acts as a **frame/container** (not an
      actual map); it is an **empty placeholder for now** (to be evolved
      later). It is protected — an unauthenticated visitor is redirected to
      `/login`. After login the user is routed to `/`.
    - **`apps/web` must stay on TypeScript 6.x, not 7.x** — Next.js 16 doesn't
      support TS 7 yet (crashes trying to npm-auto-install a "missing"
      TypeScript that's actually already installed). `apps/api` is pinned to
      6.x too, kept in sync rather than mixing major versions across the repo.
  - `apps/api` — **Bun** back-end. Uses **Supabase Auth** (`supabase-js`) to
    verify Google login tokens, and connects **directly to Postgres**
    (Supabase's connection string, via `Bun.SQL`) for data — **not** through
    `supabase-js .from()`/PostgREST. apps/api is a trusted service using the
    service role key, which already bypasses PostgREST's reason to exist
    (Row Level Security), so going through it would just be an extra network
    hop for nothing.
- The back-end MUST follow **Clean Architecture + DDD**:
  - Layers: `domain` → `usecase` → `interface`, with `infrastructure`
    implementing the interfaces defined by inner layers.
  - **Dependency rule:** dependencies point inward only. `domain` has no
    framework or I/O dependencies. Supabase Auth client and Postgres client
    both stay inside `infrastructure/`, behind interfaces (`AuthGateway`,
    `UserRepository`).
- Shared request/response **contracts (DTOs) live in `apps/shared/dtos`** as a
  workspace package. Both apps import from there — never duplicate contracts.

### User schema

- **`id` is a UUIDv7**, generated in the usecase layer via
  `Bun.randomUUIDv7()` — never a Postgres default.
- **`isVip`** — boolean, **mandatory, defaults to `false`**. Never nullable.
- **`isVip` is player-owned profile state, not an auth claim — preserve it
  across logins.** Only `email`/`displayName`/`avatarUrl` re-sync from the
  identity provider on each login.
- `users` is auth/profile only. The on-screen name lives on `players` as
  `player_name` — never on `users` — so gameplay concerns
  never mix into the auth table. Same constraint as the old `username` did:
  nullable, 5-40 alphanumeric characters (`^[A-Za-z0-9]{5,40}$`), enforced in
  both `Player.create()` and a DB `CHECK` constraint, null until the player
  sets one.

## Tooling

- **Biome** is the one linter + formatter for the whole repo — both `apps/web`
  and `apps/api`. Do not add ESLint or Prettier.
- **husky + lint-staged** is the git hook manager.
- **Trivy** and **`bun audit`** are both run as the vulnerability check —
  complementary, not redundant (Trivy: broad multi-ecosystem/container/IaC/
  secrets; `bun audit`: Bun-native CVE check against `bun.lock`).
- Assume every developer and CI runner has a **Docker or Podman** runtime
  available locally, so **testcontainers** integration tests run in pre-commit
  and CI.

## Back-end quality gates (`apps/api`)

A back-end commit MUST NOT pass unless **all** of these succeed:

1. **Biome** passes (lint + format).
2. **Unit tests** pass (`bun test`).
3. **Integration tests** pass (using **testcontainers**).
4. **`usecase/` folder coverage ≥ 85%** — measured from the **integration**
   run only, scoped to `src/usecase/**`. Unit-test coverage does NOT count.
   (Raised from 75% once the suite had enough integration tests in place to
   hold a higher bar comfortably — see `apps/api/scripts/check-usecase-
   coverage.ts`.)

- These gates run in **pre-commit** and are mirrored in **CI** (do not bypass
  with `--no-verify`). Concretely, `.husky/pre-commit` runs `bun run
  test:api:unit` **and** `bun run test:api:integration:coverage` (the latter
  both runs the integration suite and enforces the ≥85% gate) whenever staged
  files touch `apps/api/`.
- Use **testcontainers** for integration tests — cover the **happy path** and
  key **edge cases**.
- The **85% coverage requirement applies specifically to the `usecase/` folder**
  (Clean Architecture use cases) and is derived from the integration suite.
- **Integration test files share ONE testcontainers Postgres** via
  `tests/integration/support/sharedPostgresEnvironment.ts` (`
  getSharedPostgresEnvironment()`) instead of each file starting its own —
  don't revert individual files back to calling `startPostgresEnvironment()`
  directly, that was the pre-fix pattern and is slower for no benefit.
- **Known Bun 1.3.10 bug — never write
  `await expect(promise).rejects.toBeInstanceOf(ErrorClass)`** when `promise`'s
  chain includes a `Bun.SQL` query (i.e. almost every integration-test
  rejection assertion). It hangs forever: confirmed via `pg_stat_activity`
  that Postgres finishes the query and goes idle, but the JS promise never
  settles — a Bun-internal bug, not a real deadlock. Use
  `tests/integration/support/expectRejection.ts`'s `expectRejection(promise,
  ErrorClass)` helper instead (plain try/catch under the hood). If a "the
  integration suite hangs for a very long time" report comes up again, this
  is the first thing to check — confirm the Podman machine is actually
  running (`podman info`) first, then grep the diff for a reintroduced
  `.rejects.toBeInstanceOf(`.

### Back-end CI (`.github/workflows/api-ci.yml`)

**One workflow, one sequential pipeline job** (not separate parallel jobs):

1. **Lint (Biome)**
2. **Vulnerability check (Trivy)** — pinned to a commit SHA, not a version
   tag, in the workflow file (`aquasecurity/trivy-action` had 76 of 77 tags
   hijacked in a March 2026 supply-chain attack).
3. **Unit tests** (`bun test`)
4. **Build** (`docker build` on `apps/api/Dockerfile`)
5. **Deploy on Render** — push to `main` only

Every step in that job blocks the next on failure. **Integration tests are a
separate, optional job** in the same workflow file — no `needs:` link to the
pipeline job, `continue-on-error: true`, so it never blocks lint/vuln/unit/
build/deploy. It still produces the `usecase/` ≥ 85% coverage report; that
gate is hard-enforced in **pre-commit** (integration tests always run there —
see above) but only advisory in CI, matching its optional status.

## Deployment

- Both `apps/web` and `apps/api` are deployed on **Render** as separate services
  (see `render.yaml`).
- Secrets (Supabase keys, Google OAuth credentials, API URLs) are configured as
  Render env vars and are **never committed**.

## Conventions

- Shared contract types between web and api live in `apps/shared/dtos` —
  import from there, never duplicate DTOs.
- Don't put business logic in `interface/` or `infrastructure/`; it belongs in
  `domain/` and `usecase/`.
