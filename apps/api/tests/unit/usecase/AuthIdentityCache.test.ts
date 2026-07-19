import { describe, expect, it } from "bun:test";
import { AuthIdentityCache } from "@/usecase/auth/AuthIdentityCache";
import type {
  AuthIdentityResolver,
  ResolvedAuthIdentity,
} from "@/usecase/auth/AuthIdentityResolver";

class CountingAuthIdentityResolver implements AuthIdentityResolver {
  calls = 0;

  constructor(private readonly byExternalAuthId: Map<string, ResolvedAuthIdentity>) {}

  async resolve(externalAuthId: string) {
    this.calls++;
    return this.byExternalAuthId.get(externalAuthId) ?? null;
  }
}

describe("AuthIdentityCache", () => {
  it("delegates to the resolver on a cold cache", async () => {
    const resolver = new CountingAuthIdentityResolver(
      new Map([["ext-1", { playerId: "player-1", isVip: false }]]),
    );
    const cache = new AuthIdentityCache(resolver);

    const result = await cache.resolve("ext-1");

    expect(result).toEqual({ playerId: "player-1", isVip: false });
    expect(resolver.calls).toBe(1);
  });

  it("serves a repeat lookup from the cache without calling the resolver again", async () => {
    const resolver = new CountingAuthIdentityResolver(
      new Map([["ext-1", { playerId: "player-1", isVip: false }]]),
    );
    const cache = new AuthIdentityCache(resolver);

    await cache.resolve("ext-1");
    const result = await cache.resolve("ext-1");

    expect(result).toEqual({ playerId: "player-1", isVip: false });
    expect(resolver.calls).toBe(1);
  });

  it("does not cache a resolver miss, so the next call retries", async () => {
    const resolver = new CountingAuthIdentityResolver(new Map());
    const cache = new AuthIdentityCache(resolver);

    const first = await cache.resolve("ext-unknown");
    const second = await cache.resolve("ext-unknown");

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(resolver.calls).toBe(2);
  });

  it("remember() populates the cache without touching the resolver", async () => {
    const resolver = new CountingAuthIdentityResolver(new Map());
    const cache = new AuthIdentityCache(resolver);

    cache.remember("ext-1", { playerId: "player-1", isVip: true });
    const result = await cache.resolve("ext-1");

    expect(result).toEqual({ playerId: "player-1", isVip: true });
    expect(resolver.calls).toBe(0);
  });

  it("keys different identities independently", async () => {
    const resolver = new CountingAuthIdentityResolver(
      new Map([
        ["ext-1", { playerId: "player-1", isVip: false }],
        ["ext-2", { playerId: "player-2", isVip: true }],
      ]),
    );
    const cache = new AuthIdentityCache(resolver);

    const first = await cache.resolve("ext-1");
    const second = await cache.resolve("ext-2");

    expect(first).toEqual({ playerId: "player-1", isVip: false });
    expect(second).toEqual({ playerId: "player-2", isVip: true });
    expect(resolver.calls).toBe(2);
  });
});
