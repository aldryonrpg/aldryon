import { KeyedTtlCache } from "@/domain/shared/TtlCache";
import type {
  AuthIdentityResolver,
  ResolvedAuthIdentity,
} from "@/usecase/auth/AuthIdentityResolver";

// Short on purpose: authMiddleware runs on every request, so this cache is
// what actually keeps the DB off the hot path — but playerId, while
// effectively permanent once created, is still a real DB fact, so a short
// TTL is a cheap safety margin rather than caching indefinitely. 300s
// (5min), not 60s — a player battling through a session stays logged in
// well past a minute, so 60s was re-hitting the DB far more than the
// "effectively permanent" fact actually warranted.
const CACHE_TTL_MS = 300_000;

/**
 * Per-process cache in front of AuthIdentityResolver, keyed by externalAuthId
 * (same per-process/per-Render-replica model as TtlCache/MonsterCatalogCache
 * — see domain/shared/TtlCache.ts). A hit skips the DB entirely; a miss
 * falls through to the resolver's single joined query, which is itself the
 * fast path in front of authMiddleware's slower create-on-first-login
 * fallback (see AuthIdentityResolver's doc comment).
 */
export class AuthIdentityCache {
  private readonly cache = new KeyedTtlCache<string, ResolvedAuthIdentity>(CACHE_TTL_MS);

  constructor(private readonly resolver: AuthIdentityResolver) {}

  async resolve(externalAuthId: string): Promise<ResolvedAuthIdentity | null> {
    const cached = this.cache.get(externalAuthId);
    if (cached) return cached;

    const resolved = await this.resolver.resolve(externalAuthId);
    if (resolved) this.cache.set(externalAuthId, resolved);
    return resolved;
  }

  /** Populates the cache after authMiddleware's slow-path fallback resolves
   * (or creates) a player, so the next request for this identity hits. */
  remember(externalAuthId: string, identity: ResolvedAuthIdentity): void {
    this.cache.set(externalAuthId, identity);
  }
}
