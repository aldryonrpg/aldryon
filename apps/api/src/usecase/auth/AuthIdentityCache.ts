import { KeyedTtlCache } from "@/domain/shared/TtlCache";
import type {
  AuthIdentityResolver,
  ResolvedAuthIdentity,
} from "@/usecase/auth/AuthIdentityResolver";

// Short on purpose: authMiddleware runs on every request, so this cache is
// what actually keeps the DB off the hot path — but isVip is real profile
// state an admin can toggle, so a short TTL bounds how stale that can get
// instead of caching it indefinitely.
const CACHE_TTL_MS = 60_000;

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
