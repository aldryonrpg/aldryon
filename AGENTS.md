# Aldryon — Agent Rules

The authoritative project rules live in **[`CLAUDE.md`](CLAUDE.md)**. Read and
follow that file. The full bootstrap plan is in
[`.claude/plan1.md`](.claude/plan1.md).

Summary of the non-negotiable rules (see `CLAUDE.md` for detail):

- **Monorepo**: `apps/web` (Next.js front-end, Google login, proxies to the
  back-end) + `apps/api` (Bun back-end, Supabase for DB + Google auth).
- Back-end uses **Clean Architecture + DDD** (dependencies point inward;
  Supabase stays in `infrastructure/`).
- **Biome** is the only linter/formatter for both apps (no ESLint/Prettier).
  Hook manager is **husky + lint-staged**; vulnerability scanner is **Trivy**.
- Shared contracts (DTOs) live in **`apps/shared/dtos`** — never duplicate them.
- Assume a **Docker or Podman** runtime is always available locally, so
  **testcontainers** integration tests run in pre-commit and CI.
- Back-end **pre-commit + CI gates**: Biome, unit tests, integration tests
  (**testcontainers**, happy path + edge cases), and **≥ 75% coverage on the
  `usecase/` folder measured from the integration run only**. Never bypass with
  `--no-verify`.
- **Back-end CI stages (in order):** Biome linter → **Trivy** vuln check →
  `bun test` unit tests → optional testcontainers integration (produces the
  usecase coverage report) → deploy on **Render**. Every stage is required and
  blocking **except** the optional integration stage.
- Both apps deploy on **Render**; secrets are never committed.
