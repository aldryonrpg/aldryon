import type { AuthenticatedIdentity } from "@/domain/user/AuthenticatedIdentity";

/**
 * Port implemented by infrastructure (Supabase) to turn an opaque access
 * token into proven identity claims. The usecase layer never talks to
 * Supabase directly.
 */
export interface AuthGateway {
  verifyAccessToken(accessToken: string): Promise<AuthenticatedIdentity>;
}

export class InvalidAccessTokenError extends Error {
  constructor(cause?: unknown) {
    super("Access token could not be verified");
    this.name = "InvalidAccessTokenError";
    this.cause = cause;
  }
}
