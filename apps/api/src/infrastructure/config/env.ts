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
    // Use the **transaction-mode pooler** (port 6543, Supavisor), not the
    // *direct* connection (port 5432) — confirmed empirically: the direct
    // connection often only resolves over IPv6, which container/VM network
    // setups without IPv6 egress (Podman's WSL VM locally, and likely
    // Render's containers too, since it deploys apps/api the same way)
    // fail to reach at all (`ERR_POSTGRES_CONNECTION_CLOSED`). The pooler
    // is IPv4-safe and works identically from a bare host or a container.
    databaseUrl: requireEnv("DATABASE_URL"),
    // Explicit Postgres connection-pool sizing instead of relying on
    // Bun.SQL's implicit defaults (max=10, idleTimeout=0/never expires,
    // prepare=true) — see createPostgresClient. Kept as ENV knobs, not
    // hardcoded, so Render can be retuned without a code deploy.
    // DATABASE_POOL_PREPARE **must** be `false` under the transaction-mode
    // pooler above — prepared statements can land on a different backend
    // connection than the one that created them under that pooling mode.
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
  };
}

export type Env = ReturnType<typeof loadEnv>;
