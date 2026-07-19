import type { Context, MiddlewareHandler } from "hono";
import type { AuthGateway } from "@/usecase/auth/AuthGateway";
import { InvalidAccessTokenError } from "@/usecase/auth/AuthGateway";
import type { AuthIdentityCache } from "@/usecase/auth/AuthIdentityCache";
import type { GetOrCreatePlayerUseCase } from "@/usecase/player/GetOrCreatePlayerUseCase";
import type { UserRepository } from "@/usecase/user/UserRepository";

export interface AuthedVariables {
  playerId: string;
}

/**
 * Verifies the `Authorization: Bearer <supabaseAccessToken>` header via the
 * existing AuthGateway (plan1), then resolves playerId for downstream
 * gameplay controllers. This runs on every authenticated request, so the
 * common case goes through authIdentityCache first (in-memory hit, or its
 * single joined DB query) — the User-then-get-or-create-Player path below is
 * only the fallback for a cache/resolver miss, which is just the true
 * first-ever-login case (must create the Player row) or a cold cache.
 *
 * Doesn't resolve `isVip` (plan4 §8) — that lives on `players` now, and
 * every usecase that needs it reads `player.isVip` directly off the Player
 * row it loads via `playerRepository.findById`, rather than this middleware
 * threading a second, separately-cached copy of the same fact through
 * context.
 */
export function createAuthMiddleware(
  authGateway: AuthGateway,
  userRepository: UserRepository,
  getOrCreatePlayerUseCase: GetOrCreatePlayerUseCase,
  authIdentityCache: AuthIdentityCache,
): MiddlewareHandler<{ Variables: AuthedVariables }> {
  return async (c: Context<{ Variables: AuthedVariables }>, next) => {
    const header = c.req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

    if (!token) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "Missing bearer token" } }, 401);
    }

    try {
      const identity = await authGateway.verifyAccessToken(token);

      const cached = await authIdentityCache.resolve(identity.externalAuthId);
      if (cached) {
        c.set("playerId", cached.playerId);
        await next();
        return;
      }

      const user = await userRepository.findByExternalAuthId(identity.externalAuthId);
      if (!user) {
        return c.json(
          {
            error: { code: "UNAUTHORIZED", message: "No account for this identity — log in first" },
          },
          401,
        );
      }

      const { player } = await getOrCreatePlayerUseCase.execute({ userId: user.id });
      authIdentityCache.remember(identity.externalAuthId, { playerId: player.id });
      c.set("playerId", player.id);
      await next();
    } catch (err) {
      if (err instanceof InvalidAccessTokenError) {
        return c.json({ error: { code: "INVALID_TOKEN", message: err.message } }, 401);
      }
      throw err;
    }
  };
}
