import type { Context, MiddlewareHandler } from "hono";
import type { AuthGateway } from "@/usecase/auth/AuthGateway";
import { InvalidAccessTokenError } from "@/usecase/auth/AuthGateway";
import type { GetOrCreatePlayerUseCase } from "@/usecase/player/GetOrCreatePlayerUseCase";
import type { UserRepository } from "@/usecase/user/UserRepository";

export interface AuthedVariables {
  playerId: string;
  isVip: boolean;
}

/**
 * Verifies the `Authorization: Bearer <supabaseAccessToken>` header via the
 * existing AuthGateway (plan1), resolves the User (must already exist — you
 * log in before playing), and gets-or-creates the 1:1 Player. Downstream
 * gameplay controllers read `c.get("playerId")` / `c.get("isVip")`.
 */
export function createAuthMiddleware(
  authGateway: AuthGateway,
  userRepository: UserRepository,
  getOrCreatePlayerUseCase: GetOrCreatePlayerUseCase,
): MiddlewareHandler<{ Variables: AuthedVariables }> {
  return async (c: Context<{ Variables: AuthedVariables }>, next) => {
    const header = c.req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

    if (!token) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "Missing bearer token" } }, 401);
    }

    try {
      const identity = await authGateway.verifyAccessToken(token);
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
      c.set("playerId", player.id);
      c.set("isVip", user.isVip);
      await next();
    } catch (err) {
      if (err instanceof InvalidAccessTokenError) {
        return c.json({ error: { code: "INVALID_TOKEN", message: err.message } }, 401);
      }
      throw err;
    }
  };
}
