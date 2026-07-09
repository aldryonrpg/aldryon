import type { Env } from "@/infrastructure/config/env";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the service role key. Confined to
 * infrastructure — domain and usecase code never import this directly.
 */
export function createSupabaseClient(
  env: Pick<Env, "supabaseUrl" | "supabaseServiceRoleKey">,
): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
