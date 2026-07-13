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
    // Used only to verify Supabase Auth (GoTrue) tokens — see SupabaseAuthGateway.
    supabaseUrl: requireEnv("SUPABASE_URL"),
    supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    // Direct Postgres connection (Supabase's connection string) for data
    // access — apps/api is a trusted service, so it skips PostgREST/RLS
    // entirely and talks to Postgres directly. See PostgresUserRepository.
    databaseUrl: requireEnv("DATABASE_URL"),
    // Attribute points granted per level-up (plan2 §6b) — kept as an ENV
    // knob specifically because 4-vs-5 is still being playtested; the
    // domain never reads process.env directly, only this loader does.
    levelUpAttributePoints: Number(process.env.LEVEL_UP_ATTRIBUTE_POINTS ?? 4),
    // Rounds a Stun-applying special is excluded from the AI's selection
    // pool after it unleashes, so it can never be re-triggered back-to-back
    // (plan2 §6a extension) — kept as an ENV knob for the same reason as
    // levelUpAttributePoints: it's a balance number, not a code decision.
    stunCooldownRounds: Number(process.env.STUN_COOLDOWN_ROUNDS ?? 5),
  };
}

export type Env = ReturnType<typeof loadEnv>;
