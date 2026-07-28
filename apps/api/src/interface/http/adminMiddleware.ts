import type { Context, MiddlewareHandler } from "hono";
import type { AdminRepository } from "@/usecase/admin/AdminRepository";
import type { AuthGateway } from "@/usecase/auth/AuthGateway";
import { InvalidAccessTokenError } from "@/usecase/auth/AuthGateway";
import type { UserRepository } from "@/usecase/user/UserRepository";

export interface AdminVariables {
  adminUserId: string;
}

/**
 * Gates every `/admin/*` route (plan9 §4). Deliberately separate from
 * authMiddleware.ts, which resolves a `playerId` for gameplay routes —
 * admin routes need a `userId` and an `admins` row, nothing about a
 * Player, so there's no reason to route them through
 * getOrCreatePlayerUseCase or the gameplay identity cache.
 */
export function createAdminMiddleware(
  authGateway: AuthGateway,
  userRepository: UserRepository,
  adminRepository: AdminRepository,
): MiddlewareHandler<{ Variables: AdminVariables }> {
  return async (c: Context<{ Variables: AdminVariables }>, next) => {
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

      if (!(await adminRepository.isAdmin(user.id))) {
        return c.json({ error: { code: "FORBIDDEN", message: "Admin access required" } }, 403);
      }

      c.set("adminUserId", user.id);
      await next();
    } catch (err) {
      if (err instanceof InvalidAccessTokenError) {
        return c.json({ error: { code: "INVALID_TOKEN", message: err.message } }, 401);
      }
      throw err;
    }
  };
}
