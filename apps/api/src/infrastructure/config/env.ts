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
    // Direct Postgres connection (Supabase's connection string) for data
    // access — apps/api is a trusted service, so it skips PostgREST/RLS
    // entirely and talks to Postgres directly. See PostgresUserRepository.
    databaseUrl: requireEnv("DATABASE_URL"),
    // Explicit Postgres connection-pool sizing instead of relying on
    // Bun.SQL's implicit defaults (max=10, idleTimeout=0/never expires,
    // prepare=true) — see createPostgresClient. Kept as ENV knobs, not
    // hardcoded, so Render can be retuned without a code deploy: today
    // DATABASE_URL is Supabase's *direct* connection (no pooler in front),
    // where every pool connection is a real, scarce backend connection
    // against Supabase's own max_connections — idleTimeout matters here
    // specifically so idle connections get released. When testing
    // Supabase's transaction-mode pooler (port 6543) later, set
    // DATABASE_POOL_PREPARE=false — prepared statements can land on a
    // different backend connection than the one that created them under
    // transaction-mode pooling.
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
