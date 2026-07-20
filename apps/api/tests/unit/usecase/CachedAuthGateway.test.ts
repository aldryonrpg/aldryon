import { describe, expect, it } from "bun:test";
import { SignJWT } from "jose";
import { type AuthGateway, InvalidAccessTokenError } from "@/usecase/auth/AuthGateway";
import { CachedAuthGateway } from "@/usecase/auth/CachedAuthGateway";

const IDENTITY = {
  externalAuthId: "google-oauth2|player-1",
  email: "player@example.com",
  displayName: "Player One",
  avatarUrl: null,
};

class CountingAuthGateway implements AuthGateway {
  calls = 0;
  shouldFail = false;

  async verifyAccessToken() {
    this.calls++;
    if (this.shouldFail) throw new InvalidAccessTokenError();
    return IDENTITY;
  }
}

async function tokenExpiringIn(seconds: number): Promise<string> {
  // jti is otherwise unused — just here so two calls with identical
  // sub/exp still produce distinct token strings (HS256 signing is
  // deterministic, so identical claims would otherwise collide as the
  // same cache key).
  return new SignJWT({ sub: IDENTITY.externalAuthId, jti: crypto.randomUUID() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + seconds)
    .sign(new TextEncoder().encode("irrelevant-since-CachedAuthGateway-never-verifies-signatures"));
}

describe("CachedAuthGateway", () => {
  it("delegates to the inner gateway on a cold cache", async () => {
    const inner = new CountingAuthGateway();
    const gateway = new CachedAuthGateway(inner);
    const token = await tokenExpiringIn(3600);

    const result = await gateway.verifyAccessToken(token);

    expect(result).toEqual(IDENTITY);
    expect(inner.calls).toBe(1);
  });

  it("serves a repeat lookup of the same token from the cache", async () => {
    const inner = new CountingAuthGateway();
    const gateway = new CachedAuthGateway(inner);
    const token = await tokenExpiringIn(3600);

    await gateway.verifyAccessToken(token);
    const result = await gateway.verifyAccessToken(token);

    expect(result).toEqual(IDENTITY);
    expect(inner.calls).toBe(1);
  });

  it("does not cache a failed verification, so the next call retries", async () => {
    const inner = new CountingAuthGateway();
    inner.shouldFail = true;
    const gateway = new CachedAuthGateway(inner);
    const token = await tokenExpiringIn(3600);

    await expect(gateway.verifyAccessToken(token)).rejects.toBeInstanceOf(InvalidAccessTokenError);
    await expect(gateway.verifyAccessToken(token)).rejects.toBeInstanceOf(InvalidAccessTokenError);

    expect(inner.calls).toBe(2);
  });

  it("keys different tokens independently", async () => {
    const inner = new CountingAuthGateway();
    const gateway = new CachedAuthGateway(inner);
    const tokenA = await tokenExpiringIn(3600);
    const tokenB = await tokenExpiringIn(3600);

    await gateway.verifyAccessToken(tokenA);
    await gateway.verifyAccessToken(tokenB);
    await gateway.verifyAccessToken(tokenA);

    expect(inner.calls).toBe(2);
  });

  it("re-verifies once a token whose own exp is shorter than the cache TTL has passed", async () => {
    const inner = new CountingAuthGateway();
    const gateway = new CachedAuthGateway(inner);
    // exp 1s in the future — far shorter than the 60s cache TTL, so the
    // cache entry should be capped at ~1s, not the full 60s.
    const token = await tokenExpiringIn(1);

    await gateway.verifyAccessToken(token);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await gateway.verifyAccessToken(token);

    expect(inner.calls).toBe(2);
  });
});
