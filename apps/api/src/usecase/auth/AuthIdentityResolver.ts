export interface ResolvedAuthIdentity {
  playerId: string;
  isVip: boolean;
}

/**
 * Fast path for authMiddleware (runs on every authenticated request): a
 * single joined lookup instead of the two separate round trips
 * (UserRepository.findByExternalAuthId, then GetOrCreatePlayerUseCase's own
 * findByUserId) needed the very first time an identity is ever seen. Returns
 * null whenever the join comes back empty — either no `users` row at all, or
 * a `users` row with no `players` row yet (the true first-ever login) — the
 * caller can't tell which from this alone and isn't meant to: on a miss,
 * authMiddleware falls back to the slower, correctness-guaranteed
 * user-then-get-or-create-player path, which already distinguishes those
 * two cases.
 */
export interface AuthIdentityResolver {
  resolve(externalAuthId: string): Promise<ResolvedAuthIdentity | null>;
}
