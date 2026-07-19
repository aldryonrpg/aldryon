import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose";
import type { AuthenticatedIdentity } from "@/domain/user/AuthenticatedIdentity";
import { type AuthGateway, InvalidAccessTokenError } from "@/usecase/auth/AuthGateway";

interface SupabaseAccessTokenClaims {
  sub: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
    avatar_url?: string;
  };
}

/**
 * Verifies a Supabase access token entirely locally — against the project's
 * public JWKS (this project signs with an asymmetric ECC/P-256 key, not the
 * legacy HS256 shared secret; confirmed via a live `ERR_JOSE_ALG_NOT_ALLOWED`
 * rejection before this class settled on JWKS) — no network round trip to
 * GoTrue on the request path, and no secret to hold at all: `jose`'s
 * `createRemoteJWKSet` fetches and caches Supabase's *public* signing keys
 * from `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, itself just the
 * already-public project URL. Every claim this needs (sub/email/
 * user_metadata) is already embedded in the token Supabase issued, so
 * there's nothing a live `auth.getUser()` call would tell us that the token
 * itself doesn't already prove. Trades live revocation checking for zero
 * per-request latency — wrap with CachedAuthGateway (usecase/auth) for a
 * short TTL on top, same risk posture the rest of this codebase already
 * accepts for playerId via AuthIdentityCache.
 *
 * `getKey` is injected (rather than this class calling `createRemoteJWKSet`
 * itself) so unit tests can substitute `jose`'s `createLocalJWKSet` with a
 * locally generated keypair — no network fetch needed to test verification
 * logic. Production wiring goes through the `forProject` factory below.
 */
export class SupabaseAuthGateway implements AuthGateway {
  constructor(private readonly getKey: JWTVerifyGetKey) {}

  static forProject(supabaseUrl: string): SupabaseAuthGateway {
    const jwksUrl = new URL("/auth/v1/.well-known/jwks.json", supabaseUrl);
    return new SupabaseAuthGateway(createRemoteJWKSet(jwksUrl));
  }

  async verifyAccessToken(accessToken: string): Promise<AuthenticatedIdentity> {
    let claims: SupabaseAccessTokenClaims;
    try {
      const { payload } = await jwtVerify(accessToken, this.getKey);
      claims = payload as unknown as SupabaseAccessTokenClaims;
    } catch (err) {
      throw new InvalidAccessTokenError(err);
    }

    if (!claims.sub) {
      throw new InvalidAccessTokenError();
    }

    const metadata = claims.user_metadata ?? {};
    return {
      externalAuthId: claims.sub,
      email: claims.email ?? "",
      displayName: metadata.full_name ?? metadata.name ?? null,
      avatarUrl: metadata.avatar_url ?? null,
    };
  }
}
