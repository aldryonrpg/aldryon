function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadEnv() {
  return {
    port: Number(process.env.PORT ?? 3001),
    // The project's public URL, used only to build the JWKS endpoint
    // (`${supabaseUrl}/auth/v1/.well-known/jwks.json`) SupabaseAuthGateway
    // verifies access tokens against locally — no GoTrue round trip, no
    // Supabase SDK client needed in apps/api at all. Not a secret (it's the
    // same value exposed client-side as NEXT_PUBLIC_SUPABASE_URL) — this
    // project signs tokens with an asymmetric ECC/P-256 key, so there's no
    // shared secret to hold at all, only this public URL.
    supabaseUrl: requireEnv("SUPABASE_URL"),
    // Postgres connection (Supabase's connection string) for data access —
    // apps/api is a trusted service, so it skips PostgREST/RLS entirely and
    // talks to Postgres directly. See PostgresUserRepository.
    //
    // Use the pooler host (aws-*.pooler.supabase.com), never the *direct*
    // db.<ref>.supabase.co host — confirmed empirically: the direct
    // connection often only resolves over IPv6, which container/VM network
    // setups without IPv6 egress (Podman's WSL VM locally, and likely
    // Render's containers too, since it deploys apps/api the same way)
    // fail to reach at all (`ERR_POSTGRES_CONNECTION_CLOSED`). Use the
    // pooler's **session-mode port (5432)**, not transaction-mode (6543):
    // transaction mode can hand a query to a different backend than the one
    // that prepared it, causing intermittent bind/prepared-statement
    // desync 500s under concurrent requests (confirmed live 2026-07-20 —
    // garbled "bind message has N result formats but query has M columns"
    // errors correlating with fast/overlapping play). Session mode keeps
    // one stable backend per connection and was verified safe under 20
    // concurrent prepared queries.
    databaseUrl: requireEnv("DATABASE_URL"),
    // Explicit Postgres connection-pool sizing instead of relying on
    // Bun.SQL's implicit defaults (max=10, idleTimeout=0/never expires,
    // prepare=true) — see createPostgresClient. Kept as ENV knobs, not
    // hardcoded, so Render can be retuned without a code deploy.
    // DATABASE_POOL_PREPARE should be `true` under the session-mode pooler
    // above (the default/recommended setup) — only set it `false` if
    // DATABASE_URL is switched to the transaction-mode port (6543) instead.
    databasePoolMax: Number(process.env.DATABASE_POOL_MAX ?? 10),
    databasePoolIdleTimeoutSeconds: Number(process.env.DATABASE_POOL_IDLE_TIMEOUT ?? 30),
    databasePoolMaxLifetimeSeconds: Number(process.env.DATABASE_POOL_MAX_LIFETIME ?? 1800),
    databasePoolPrepareStatements: (process.env.DATABASE_POOL_PREPARE ?? "true") === "true",
    // Attribute points granted per level-up (plan2 §6b) — kept as an ENV
    // knob specifically because 4-vs-5 is still being playtested; the
    // domain never reads process.env directly, only this loader does.
    levelUpAttributePoints: Number(process.env.LEVEL_UP_ATTRIBUTE_POINTS ?? 4),
    // Rounds a Stun/Fear/Magic-Aura-Blast-applying special is excluded from
    // the AI's selection pool after it unleashes, so none of them can be
    // re-triggered back-to-back (plan2 §6a extension, widened to cover the
    // stat-decay debuffs too since they don't stack) — kept as an ENV knob
    // for the same reason as levelUpAttributePoints: it's a balance number,
    // not a code decision.
    statusCooldownRounds: Number(process.env.STATUS_COOLDOWN_ROUNDS ?? 5),
    // Flat per-attribute bonus for wearing a complete 6-piece equipment set
    // (equipment-sets follow-up) — kept as an ENV knob for the same reason
    // as the other balance numbers above: it's a tuning value, not a code
    // decision.
    setAttributeBonus: Number(process.env.SET_ATTRIBUTE_BONUS ?? 2),
    // Wild-region level gates for /battle/start — forest/bandit/sewage stay
    // open from level 1 (no knob needed), only Mountain Pass and Ancient
    // Ruins are gated. Kept as ENV knobs for the same reason as the other
    // balance numbers above: still-tunable design decisions, not code.
    mountainLevelRequirement: Number(process.env.MOUNTAIN_LEVEL_REQUIREMENT ?? 4),
    ruinsLevelRequirement: Number(process.env.RUINS_LEVEL_REQUIREMENT ?? 6),
  };
}

export type Env = ReturnType<typeof loadEnv>;
