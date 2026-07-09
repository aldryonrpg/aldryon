import type { AuthenticatedIdentity } from "@/domain/user/AuthenticatedIdentity";
import { type AuthGateway, InvalidAccessTokenError } from "@/usecase/auth/AuthGateway";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Verifies a Supabase access token (issued after the client-side Google
 * OAuth redirect) by asking Supabase who it belongs to. Never trusts the
 * token's claims without this round trip.
 */
export class SupabaseAuthGateway implements AuthGateway {
  constructor(private readonly supabase: SupabaseClient) {}

  async verifyAccessToken(accessToken: string): Promise<AuthenticatedIdentity> {
    const { data, error } = await this.supabase.auth.getUser(accessToken);

    if (error || !data.user) {
      throw new InvalidAccessTokenError(error);
    }

    const { user } = data;
    const metadata = user.user_metadata ?? {};

    return {
      externalAuthId: user.id,
      email: user.email ?? "",
      displayName:
        (metadata.full_name as string | undefined) ?? (metadata.name as string | undefined) ?? null,
      avatarUrl: (metadata.avatar_url as string | undefined) ?? null,
    };
  }
}
