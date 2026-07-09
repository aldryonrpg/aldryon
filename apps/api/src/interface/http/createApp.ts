import { createAuthController } from "@/interface/http/authController";
import type { AuthenticateUserUseCase } from "@/usecase/auth/AuthenticateUserUseCase";
import { Hono } from "hono";
import { cors } from "hono/cors";

export interface AppDependencies {
  authenticateUserUseCase: AuthenticateUserUseCase;
  webOrigin: string;
}

export function createApp(deps: AppDependencies): Hono {
  const app = new Hono();

  app.use("*", cors({ origin: deps.webOrigin, credentials: true }));

  app.get("/health", (c) => c.json({ status: "ok" }));
  app.route("/", createAuthController(deps.authenticateUserUseCase));

  return app;
}
