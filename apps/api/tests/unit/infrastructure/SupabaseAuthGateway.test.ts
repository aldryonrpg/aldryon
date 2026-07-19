import { beforeAll, describe, expect, it } from "bun:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, type JWTVerifyGetKey, SignJWT } from "jose";
import { SupabaseAuthGateway } from "@/infrastructure/auth/SupabaseAuthGateway";
import { InvalidAccessTokenError } from "@/usecase/auth/AuthGateway";

// This project signs Supabase access tokens with an asymmetric ECC/P-256
// key (confirmed live via a real ERR_JOSE_ALG_NOT_ALLOWED rejection before
// SupabaseAuthGateway settled on JWKS verification) — so tests mint their
// own ES256 keypair and a local JWKS (jose's createLocalJWKSet) rather than
// hitting a real network endpoint. SupabaseAuthGateway takes the
// JWTVerifyGetKey function directly (not a URL) for exactly this reason.
let privateKey: CryptoKey;
let getKey: JWTVerifyGetKey;
let otherPrivateKey: CryptoKey;

beforeAll(async () => {
  const keypair = await generateKeyPair("ES256", { extractable: true });
  privateKey = keypair.privateKey;
  const publicJwk = await exportJWK(keypair.publicKey);
  getKey = createLocalJWKSet({ keys: [{ ...publicJwk, alg: "ES256", use: "sig" }] });

  const otherKeypair = await generateKeyPair("ES256", { extractable: true });
  otherPrivateKey = otherKeypair.privateKey;
});

async function signToken(
  claims: Record<string, unknown>,
  options: { signingKey?: CryptoKey; expiresInSeconds?: number } = {},
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "ES256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + (options.expiresInSeconds ?? 3600))
    .sign(options.signingKey ?? privateKey);
}

describe("SupabaseAuthGateway", () => {
  it("verifies a validly-signed token and extracts identity claims", async () => {
    const gateway = new SupabaseAuthGateway(getKey);
    const token = await signToken({
      sub: "google-oauth2|player-1",
      email: "player@example.com",
      user_metadata: { full_name: "Player One", avatar_url: "https://example.com/a.png" },
    });

    const identity = await gateway.verifyAccessToken(token);

    expect(identity).toEqual({
      externalAuthId: "google-oauth2|player-1",
      email: "player@example.com",
      displayName: "Player One",
      avatarUrl: "https://example.com/a.png",
    });
  });

  it("falls back from user_metadata.full_name to .name", async () => {
    const gateway = new SupabaseAuthGateway(getKey);
    const token = await signToken({
      sub: "google-oauth2|player-2",
      email: "player2@example.com",
      user_metadata: { name: "Player Two" },
    });

    const identity = await gateway.verifyAccessToken(token);

    expect(identity.displayName).toBe("Player Two");
    expect(identity.avatarUrl).toBeNull();
  });

  it("defaults displayName/avatarUrl to null and email to empty when absent", async () => {
    const gateway = new SupabaseAuthGateway(getKey);
    const token = await signToken({ sub: "google-oauth2|player-3" });

    const identity = await gateway.verifyAccessToken(token);

    expect(identity).toEqual({
      externalAuthId: "google-oauth2|player-3",
      email: "",
      displayName: null,
      avatarUrl: null,
    });
  });

  it("rejects a token signed with a different key", async () => {
    const gateway = new SupabaseAuthGateway(getKey);
    const token = await signToken(
      { sub: "google-oauth2|player-1" },
      { signingKey: otherPrivateKey },
    );

    await expect(gateway.verifyAccessToken(token)).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it("rejects an expired token", async () => {
    const gateway = new SupabaseAuthGateway(getKey);
    const token = await signToken({ sub: "google-oauth2|player-1" }, { expiresInSeconds: -60 });

    await expect(gateway.verifyAccessToken(token)).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it("rejects a malformed token", async () => {
    const gateway = new SupabaseAuthGateway(getKey);

    await expect(gateway.verifyAccessToken("not-a-jwt")).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });
});
