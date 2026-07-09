import { SupabaseAuthGateway } from "@/infrastructure/auth/SupabaseAuthGateway";
import { loadEnv } from "@/infrastructure/config/env";
import { PostgresUserRepository } from "@/infrastructure/persistence/PostgresUserRepository";
import { createPostgresClient } from "@/infrastructure/persistence/postgresClient";
import { createSupabaseClient } from "@/infrastructure/supabase/supabaseClient";
import { createApp } from "@/interface/http/createApp";
import { AuthenticateUserUseCase } from "@/usecase/auth/AuthenticateUserUseCase";

const env = loadEnv();
const supabase = createSupabaseClient(env);
const sql = createPostgresClient(env.databaseUrl);

const authenticateUserUseCase = new AuthenticateUserUseCase(
  new SupabaseAuthGateway(supabase),
  new PostgresUserRepository(sql),
);

const app = createApp({
  authenticateUserUseCase,
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
});

export default {
  port: env.port,
  fetch: app.fetch,
};
