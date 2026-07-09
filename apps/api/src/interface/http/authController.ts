import { LoginRequestSchema } from "@aldryon/dtos";
import { Hono } from "hono";
import { mapUserToProfile } from "@/interface/http/dto/mapUserToProfile";
import type { AuthenticateUserUseCase } from "@/usecase/auth/AuthenticateUserUseCase";
import { InvalidAccessTokenError } from "@/usecase/auth/AuthGateway";

export function createAuthController(authenticateUserUseCase: AuthenticateUserUseCase): Hono {
  const app = new Hono();

  app.post("/auth/login", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = LoginRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Malformed login request" } },
        400,
      );
    }

    try {
      const { user } = await authenticateUserUseCase.execute({
        supabaseAccessToken: parsed.data.supabaseAccessToken,
      });

      return c.json({ user: mapUserToProfile(user) }, 200);
    } catch (err) {
      if (err instanceof InvalidAccessTokenError) {
        return c.json({ error: { code: "INVALID_TOKEN", message: err.message } }, 401);
      }
      throw err;
    }
  });

  return app;
}
