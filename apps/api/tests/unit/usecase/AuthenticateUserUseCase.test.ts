import { describe, expect, it } from "bun:test";
import { User } from "@/domain/user/User";
import { AuthenticateUserUseCase } from "@/usecase/auth/AuthenticateUserUseCase";
import type { AuthGateway } from "@/usecase/auth/AuthGateway";
import { InvalidAccessTokenError } from "@/usecase/auth/AuthGateway";
import type { UserRepository } from "@/usecase/user/UserRepository";

class StubAuthGateway implements AuthGateway {
  constructor(
    private readonly result: Awaited<ReturnType<AuthGateway["verifyAccessToken"]>> | Error,
  ) {}

  async verifyAccessToken() {
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

class InMemoryUserRepository implements UserRepository {
  private readonly byExternalAuthId = new Map<string, User>();

  async findByExternalAuthId(externalAuthId: string) {
    return this.byExternalAuthId.get(externalAuthId) ?? null;
  }

  async upsert(user: User) {
    this.byExternalAuthId.set(user.externalAuthId, user);
    return user;
  }
}

describe("AuthenticateUserUseCase", () => {
  it("creates a new domain user for a first-time identity", async () => {
    const gateway = new StubAuthGateway({
      externalAuthId: "ext-1",
      email: "player@example.com",
      displayName: "Player",
      avatarUrl: null,
    });
    const repo = new InMemoryUserRepository();
    const useCase = new AuthenticateUserUseCase(gateway, repo);

    const { user } = await useCase.execute({ supabaseAccessToken: "any" });

    expect(user.externalAuthId).toBe("ext-1");
    expect(user.email).toBe("player@example.com");
    expect(user.username).toBeNull();
    expect(user.isVip).toBe(false);
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("reuses the existing user id for a returning identity", async () => {
    const repo = new InMemoryUserRepository();
    const existing = User.create({
      id: "existing-id",
      externalAuthId: "ext-2",
      email: "old@example.com",
      displayName: null,
      avatarUrl: null,
      username: null,
      isVip: false,
    });
    await repo.upsert(existing);

    const gateway = new StubAuthGateway({
      externalAuthId: "ext-2",
      email: "new@example.com",
      displayName: "Renamed",
      avatarUrl: null,
    });
    const useCase = new AuthenticateUserUseCase(gateway, repo);

    const { user } = await useCase.execute({ supabaseAccessToken: "any" });

    expect(user.id).toBe("existing-id");
    expect(user.email).toBe("new@example.com");
  });

  it("preserves username and isVip across repeat logins instead of resetting them", async () => {
    const repo = new InMemoryUserRepository();
    const existing = User.create({
      id: "existing-id",
      externalAuthId: "ext-3",
      email: "vip@example.com",
      displayName: null,
      avatarUrl: null,
      username: "DragonSlayer99",
      isVip: true,
    });
    await repo.upsert(existing);

    const gateway = new StubAuthGateway({
      externalAuthId: "ext-3",
      email: "vip@example.com",
      displayName: "Renamed",
      avatarUrl: null,
    });
    const useCase = new AuthenticateUserUseCase(gateway, repo);

    const { user } = await useCase.execute({ supabaseAccessToken: "any" });

    expect(user.username).toBe("DragonSlayer99");
    expect(user.isVip).toBe(true);
  });

  it("propagates InvalidAccessTokenError from the gateway", async () => {
    const gateway = new StubAuthGateway(new InvalidAccessTokenError());
    const repo = new InMemoryUserRepository();
    const useCase = new AuthenticateUserUseCase(gateway, repo);

    await expect(useCase.execute({ supabaseAccessToken: "bad" })).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });
});
