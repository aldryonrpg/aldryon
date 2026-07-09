# Aldryon — Project Rules

Aldryon is a text-based RPG. This repo is a **monorepo** with two deployable apps.
These rules are **non-negotiable** and apply to every instance/session working here.

See [`.claude/plan1.md`](.claude/plan1.md) for the full bootstrap plan.

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
  - `apps/api` — **Bun** back-end. Connects to **Supabase** for the database and
    for **Google auth** (Supabase Auth + Google provider).
- The back-end MUST follow **Clean Architecture + DDD**:
  - Layers: `domain` → `usecase` → `interface`, with `infrastructure`
    implementing the interfaces defined by inner layers.
  - **Dependency rule:** dependencies point inward only. `domain` has no
    framework or I/O dependencies. Supabase SDK usage stays inside
    `infrastructure/`, behind interfaces.
- Shared request/response **contracts (DTOs) live in `apps/shared/dtos`** as a
  workspace package. Both apps import from there — never duplicate contracts.

## Tooling

- **Biome** is the one linter + formatter for the whole repo — both `apps/web`
  and `apps/api`. Do not add ESLint or Prettier.
- **husky + lint-staged** is the git hook manager.
- **Trivy** is the vulnerability scanner.
- Assume every developer and CI runner has a **Docker or Podman** runtime
  available locally, so **testcontainers** integration tests run in pre-commit
  and CI.

## Back-end quality gates (`apps/api`)

A back-end commit MUST NOT pass unless **all** of these succeed:

1. **Biome** passes (lint + format).
2. **Unit tests** pass (`bun test`).
3. **Integration tests** pass (using **testcontainers**).
4. **`usecase/` folder coverage ≥ 75%** — measured from the **integration**
   run only, scoped to `src/usecase/**`. Unit-test coverage does NOT count.

- These gates run in **pre-commit** and are mirrored in **CI** (do not bypass
  with `--no-verify`).
- Use **testcontainers** for integration tests — cover the **happy path** and
  key **edge cases**.
- The **75% coverage requirement applies specifically to the `usecase/` folder**
  (Clean Architecture use cases) and is derived from the integration suite.

### Back-end CI stages (in order)

1. **Biome linter** — *required, blocking*
2. **Vulnerability check** — **Trivy** — *required, blocking*
3. **Unit tests** via `bun test` — *required, blocking*
4. **Integration tests** — testcontainers; also produces the `usecase/` ≥ 75%
   coverage report — ***optional (does NOT block the pipeline)***
5. **Deploy on Render** — after all required stages pass

**Every stage is required and fails the CI on error, EXCEPT the integration
stage, which is optional.** Because coverage is derived from the (optional)
integration stage, the coverage gate is advisory in CI but hard-enforced in
pre-commit.

## Deployment

- Both `apps/web` and `apps/api` are deployed on **Render** as separate services
  (see `render.yaml`).
- Secrets (Supabase keys, Google OAuth credentials, API URLs) are configured as
  Render env vars and are **never committed**.

## Conventions

- Keep shared contract types between web and api explicit (either in
  `packages/` or as clearly duplicated DTOs — decide once, stay consistent).
- Don't put business logic in `interface/` or `infrastructure/`; it belongs in
  `domain/` and `usecase/`.
