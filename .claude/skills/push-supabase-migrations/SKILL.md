---
name: push-supabase-migrations
description: Author a new Postgres schema migration in supabase/migrations/ (the one canonical migrations source for the whole project) and push it to the real Supabase project with the Supabase CLI, then verify the result against the live database. Use this whenever the user asks to add, push, sync, apply, deploy, or run a migration against Supabase; mentions a new table/column/constraint that needs to reach "the real database", "the cloud database", "prod", or "supabase"; hits a Postgres error like `relation "X" does not exist` while the API is pointed at a Supabase DATABASE_URL; or asks to confirm/verify that a table or constraint exists on the actual Supabase project. Trigger even if they don't say the word "migration" — phrases like "push this to supabase", "sync the schema", "add a table for X", "update supabase with the new column", or "did that change make it to the database" all mean this skill.
---

# Push Supabase Migrations

**`supabase/migrations/*.sql` is the ONE canonical migrations source for the
whole project** — there is no separate copy anywhere else. Author every
migration here, and it's automatically what the **testcontainers**
integration-test harness reads too (it runs every `*.sql` file in this
folder, sorted, against its ephemeral Postgres — see
`apps/api/tests/integration/support/postgresEnvironment.ts`). There is
deliberately **no local docker-compose Postgres** in this project — the app
always talks to the real Supabase project (see `apps/api/.env`'s
`DATABASE_URL`); the only other Postgres instance that ever exists locally is
testcontainers' throwaway one for tests.

Filenames must use the Supabase CLI's required `<timestamp>_description.sql`
format — it tracks applied migrations by that timestamp prefix in a history
table on the target database, and won't recognize any other naming scheme.

## Step 1 — write the migration

Create it with the CLI itself (don't hand-write the timestamp — let the tool
pick a valid, monotonically increasing one):

```bash
bunx supabase migration new <descriptive_name>
```

This creates an empty `supabase/migrations/<timestamp>_<descriptive_name>.sql`.
Write the SQL directly in it. That's the only place it needs to exist —
nothing to mirror, copy, or keep in sync elsewhere.

## Step 2 — preview, then push

Always dry-run first and show the user what would change — this is a real
cloud database, and the preview costs nothing:

```bash
bun run db:push:supabase:dry-run
```

Read its output back to the user in plain terms (which migration files it
would apply). Then, once they've confirmed (or if they already said
"push"/"apply"/"go ahead" for this exact change earlier in the
conversation — use judgment, don't make them repeat themselves), run the
real push:

```bash
bun run db:push:supabase
```

Both scripts wrap `bunx supabase db push --db-url "$DATABASE_URL"
--include-all --yes`, with `DATABASE_URL` read automatically out of
`apps/api/.env` by `scripts/push-supabase-migrations.ts` — there's nothing
else to configure. This intentionally skips `supabase login` /
`supabase link`: `--db-url` pushes straight against a plain Postgres
connection string, so no interactive Supabase-account OAuth step is ever
needed. If `DATABASE_URL` in `apps/api/.env` is still a placeholder or
missing, stop and tell the user to fill it in first — the push will fail
with a connection error otherwise.

A one-time Docker warning
(`failed to inspect docker image ... edge-runtime`) is expected and
harmless if Docker/Podman isn't running — it's an optional migration-catalog
cache, not the push itself. The line to look for is `Finished supabase db
push.`

## Step 3 — verify against the real database

Don't just trust the CLI's success message — confirm the table/columns/
constraints actually landed, the same way you'd sanity-check any migration.
**One gotcha to know about:** Supabase's own internal `auth.users` table
means an **unscoped** `information_schema.columns` query on a table named
`users` returns a confusing union of both tables' columns. Always filter by
`table_schema = 'public'` (a good habit for *any* table, not just `users` —
it's what avoids the exact confusion that happened the first time this
migration was verified in this repo):

```bash
cd apps/api  # so Bun auto-loads .env from here — DATABASE_URL needs to be set
bun -e '
const { SQL } = require("bun");
const sql = new SQL(process.env.DATABASE_URL, { connectionTimeout: 10 });
const TABLE = "REPLACE_WITH_TABLE_NAME";
try {
  const cols = await sql`select column_name, data_type from information_schema.columns where table_schema = ${"public"} and table_name = ${TABLE} order by ordinal_position`;
  console.log("COLUMNS:", JSON.stringify(cols, null, 2));
  const constraints = await sql`select conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid = ${"public." + TABLE}::regclass`;
  console.log("CONSTRAINTS:", JSON.stringify(constraints, null, 2));
} finally {
  await sql.close();
}
'
```

Report back what actually exists — columns, types, and constraint
definitions — rather than just relaying "it worked."

## Step 4 — check the integration tests still pass

Since testcontainers reads this same folder, a new migration should be
covered there too before calling the change done:

```bash
bun run test:api:integration
```

## Quick reference

| Thing | Where |
|---|---|
| The one canonical migrations folder | `supabase/migrations/*.sql` (timestamped) |
| Also read by | testcontainers integration harness (`apps/api/tests/integration/support/postgresEnvironment.ts`) |
| Push wrapper script | `scripts/push-supabase-migrations.ts` |
| Preview command | `bun run db:push:supabase:dry-run` |
| Real push command | `bun run db:push:supabase` |
| Supabase connection string | `apps/api/.env` → `DATABASE_URL` (gitignored) |
| Local docker Postgres | **Does not exist** — Supabase is used for everything except ephemeral test runs |
