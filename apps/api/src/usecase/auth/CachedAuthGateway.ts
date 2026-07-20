import { decodeJwt } from "jose";
import { KeyedTtlCache } from "@/domain/shared/TtlCache";
import type { AuthenticatedIdentity } from "@/domain/user/AuthenticatedIdentity";
import type { AuthGateway } from "@/usecase/auth/AuthGateway";

const CACHE_TTL_MS = 60_000;

/**
 * Wraps any AuthGateway with a short in-memory TTL cache keyed by the raw
 * access token. Local verification (SupabaseAuthGateway) is already cheap —
 * no network — but several endpoints can fire concurrently against the
 * identical token (e.g. GET /player + GET /battle + GET /items on page
 * load), so this skips the redundant signature check within the window.
 * Same per-process-only caveat as AuthIdentityCache, and deliberately the
 * same 60s TTL so both hot-path caches share one staleness budget.
 *
 * A cache entry is additionally capped at the token's own remaining `exp`
 * (via an unverified decode — the signature was already proven by `inner`
 * moments earlier, this just reads the claim) so a cached "valid" result can
 * never outlive the token it was computed from, even though 60s is
 * negligible against Supabase's default ~1h token lifetime.
 */
export class CachedAuthGateway implements AuthGateway {
  private readonly cache = new KeyedTtlCache<string, AuthenticatedIdentity>(CACHE_TTL_MS);

  constructor(private readonly inner: AuthGateway) {}

  async verifyAccessToken(accessToken: string): Promise<AuthenticatedIdentity> {
    const cached = this.cache.get(accessToken);
    if (cached) return cached;

    const identity = await this.inner.verifyAccessToken(accessToken);
    this.cache.set(accessToken, identity, this.cacheTtlFor(accessToken));
    return identity;
  }

  private cacheTtlFor(accessToken: string): number {
    try {
      const { exp } = decodeJwt(accessToken);
      if (!exp) return CACHE_TTL_MS;
      return Math.max(0, Math.min(CACHE_TTL_MS, exp * 1000 - Date.now()));
    } catch {
      return CACHE_TTL_MS;
    }
  }
}
