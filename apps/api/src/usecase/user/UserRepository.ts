import type { User } from "@/domain/user/User";

/**
 * Port implemented by infrastructure (Supabase Postgres) for user
 * persistence. The usecase layer depends only on this interface.
 */
export interface UserRepository {
  findByExternalAuthId(externalAuthId: string): Promise<User | null>;
  upsert(user: User): Promise<User>;
}
