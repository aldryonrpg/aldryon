import type { AuthenticatedIdentity } from "@/domain/user/AuthenticatedIdentity";
import { type AuthGateway, InvalidAccessTokenError } from "@/usecase/auth/AuthGateway";

/**
 * Stands in for SupabaseAuthGateway/GoTrue in integration tests — see
 * postgrestEnvironment.ts for why the real Supabase Auth service isn't
 * containerized here. Maps fixed tokens to identities so tests stay
 * deterministic.
 */
export class FakeAuthGateway implements AuthGateway {
  private readonly tokenToIdentity = new Map<string, AuthenticatedIdentity>();

  register(token: string, identity: AuthenticatedIdentity): void {
    this.tokenToIdentity.set(token, identity);
  }

  async verifyAccessToken(accessToken: string): Promise<AuthenticatedIdentity> {
    const identity = this.tokenToIdentity.get(accessToken);
    if (!identity) {
      throw new InvalidAccessTokenError();
    }
    return identity;
  }
}
