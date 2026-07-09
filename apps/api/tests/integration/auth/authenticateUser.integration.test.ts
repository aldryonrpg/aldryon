import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { PostgresUserRepository } from "@/infrastructure/persistence/PostgresUserRepository";
import { AuthenticateUserUseCase } from "@/usecase/auth/AuthenticateUserUseCase";
import { InvalidAccessTokenError } from "@/usecase/auth/AuthGateway";
import { FakeAuthGateway } from "../support/fakeAuthGateway";
import { type PostgresEnvironment, startPostgresEnvironment } from "../support/postgresEnvironment";

describe("AuthenticateUserUseCase (integration)", () => {
  let env: PostgresEnvironment;
  let authGateway: FakeAuthGateway;
  let useCase: AuthenticateUserUseCase;

  beforeAll(async () => {
    env = await startPostgresEnvironment();
    const sql = new SQL(env.connectionUri);
    authGateway = new FakeAuthGateway();
    useCase = new AuthenticateUserUseCase(authGateway, new PostgresUserRepository(sql));
  }, 120_000);

  afterAll(async () => {
    await env.stop();
  });

  it("creates a new user on first login (happy path)", async () => {
    authGateway.register("token-new-player", {
      externalAuthId: "google-oauth2|new-player",
      email: "new-player@example.com",
      displayName: "New Player",
      avatarUrl: "https://example.com/avatar.png",
    });

    const { user } = await useCase.execute({ supabaseAccessToken: "token-new-player" });

    expect(user.email).toBe("new-player@example.com");
    expect(user.displayName).toBe("New Player");
    expect(user.externalAuthId).toBe("google-oauth2|new-player");
  });

  it("reuses the same domain user id and updates profile fields on repeat login (edge case)", async () => {
    authGateway.register("token-returning-player", {
      externalAuthId: "google-oauth2|returning-player",
      email: "returning-player@example.com",
      displayName: "Old Name",
      avatarUrl: null,
    });

    const first = await useCase.execute({ supabaseAccessToken: "token-returning-player" });

    authGateway.register("token-returning-player", {
      externalAuthId: "google-oauth2|returning-player",
      email: "returning-player@example.com",
      displayName: "Updated Name",
      avatarUrl: null,
    });

    const second = await useCase.execute({ supabaseAccessToken: "token-returning-player" });

    expect(second.user.id).toBe(first.user.id);
    expect(second.user.displayName).toBe("Updated Name");
  });

  it("rejects an unverifiable access token (edge case)", async () => {
    await expect(
      useCase.execute({ supabaseAccessToken: "not-a-real-token" }),
    ).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });
});
