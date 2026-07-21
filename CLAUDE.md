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
- **Never open a Browser to check UI/frontend changes.** Finish the code
  change, run the linter, unit tests, and integration tests — that's the
  full extent of verification. The developer reviews visual/UI results
  themselves in their own browser.

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
  - `apps/api` — **Bun** back-end. Verifies Google login tokens **locally**
    against Supabase's public JWKS (`SupabaseAuthGateway`, `jose`) — no
    Supabase SDK client, no service role key, just the project's public
    `SUPABASE_URL`. Connects **directly to Postgres** (Supabase's connection
    string, via `Bun.SQL`) for data — **not** through `supabase-js
    .from()`/PostgREST — so it already bypasses PostgREST's reason to exist
    (Row Level Security) on its own request path; going through PostgREST
    would just be an extra network hop for nothing. **RLS is enabled
    deny-by-default on every `public` table with zero policies — see
    "Row Level Security" below — precisely so nothing but `apps/api`'s
    direct connection can ever read/write.**
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

- Both `apps/web` and `apps/api` are deployed on **Render** as separate services,
  set up **manually** in the Render dashboard — there is **no `render.yaml`**
  (deleted; it was never wired to a Blueprint sync and didn't reflect the real
  config). Don't recreate one unless the setup actually switches to Blueprint
  sync — until then it would just be more dead weight.
- Secrets (Supabase keys, Google OAuth credentials, API URLs) are configured as
  Render env vars (tracked in the README) and are **never committed**.
- **`apps/cron-sweep`** (a `psql`-only image running
  `sweepStaleBattles.sql` — deletes battles, dungeon or ordinary, older than
  2 days, and clears the owning player's dungeon-run state first if needed)
  is built and ready but **deliberately not provisioned as a Render Cron Job
  yet** — an extra paid Render service isn't worth it at this early stage
  with a small player base generating little stale-battle volume. Revisit
  once real usage makes abandoned battles/dungeon runs an actual DB-hygiene
  problem, not before.

## Row Level Security

- **RLS is enabled on every table in the `public` schema, with zero
  policies defined — deny-by-default.** `apps/web` exposes
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` client-side by design (any `NEXT_PUBLIC_*`
  var ships in the JS bundle), and Supabase auto-exposes every `public`
  schema table via PostgREST at
  `https://<project>.supabase.co/rest/v1/<table>`. With RLS on and no
  policies, Postgres silently returns zero rows to the `anon`/`authenticated`
  roles for every query (verified live: `GET .../rest/v1/players` with the
  anon key returns `200 []` even though the table has real rows) — so that
  public anon key can no longer read or write anything through PostgREST,
  regardless of what grants Supabase's setup gives those roles by default.
- `apps/api` is unaffected: it connects **directly to Postgres** (not
  through PostgREST) with credentials that own/bypass RLS, so its own
  request path — and the validation/authorization every usecase enforces —
  never touches this at all.
- **No policies exist and none are planned** unless a real, concrete need
  for direct PostgREST access shows up — everything legitimate goes through
  `apps/api`, so there's nothing for a policy to grant access to yet.

## Conventions

- Shared contract types between web and api live in `apps/shared/dtos` —
  import from there, never duplicate DTOs.
- Don't put business logic in `interface/` or `infrastructure/`; it belongs in
  `domain/` and `usecase/`.

### Button UI Styles (`apps/web`)

Three fixed button styles, each with a fixed scope — a button's category is
what it *does*, not what page it's on. Don't invent a fourth style or move a
button between categories without an explicit ask.

- **Gold** (`.wood-gold-button`, `apps/web/app/globals.css`) — **website
  actions**: site-level navigation/account chrome that isn't part of a
  battle or character-management flow. Logout, "Return to Map" links, the
  Login page's language toggle, the Main Page's Resume Battle/Player Sheet
  buttons.
- **Battle** (`.battle-button`, red — same bevel/gold-trim family as Gold,
  red fill instead of wood/gold) — **CTA and player-action buttons**:
  Continue, Exit, Set Name, Save, the Attack/Bag/Rest/Run action row, Pass
  (Stunned).
- **Black** (the original plain `border border-white bg-black` look) —
  **Bag slots, Equipment slots, Buy, Sell, and Claim — forever.** These are
  explicitly *not* part of the Gold/Battle overhaul and never will be;
  don't restyle them even if asked to convert "all buttons," ask first if
  that seems to be the intent.
