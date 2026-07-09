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
  };
}

export type Env = ReturnType<typeof loadEnv>;
