import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  buildAuthorizationUrl,
  createPKCEChallenge,
  createPKCEVerifier,
  exchangeAuthorizationCode,
  getOAuthConfig,
  refreshOAuthToken
} from "./oauth.js";

describe("oauth config", () => {
  it("builds a google auth url", () => {
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "client-id");
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "client-secret");

    const config = getOAuthConfig("google");
    const url = new URL(buildAuthorizationUrl(config, "state-123"));

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("state")).toBe("state-123");
    // Without a code challenge, PKCE params stay off (backward compatible).
    expect(url.searchParams.get("code_challenge")).toBeNull();
    expect(url.searchParams.get("code_challenge_method")).toBeNull();

    vi.unstubAllEnvs();
  });

  it("includes PKCE S256 params when a code challenge is provided", () => {
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "client-id");
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "client-secret");
    const config = getOAuthConfig("google");

    const verifier = createPKCEVerifier();
    const challenge = createPKCEChallenge(verifier);
    const url = new URL(buildAuthorizationUrl(config, "state-123", challenge));

    expect(url.searchParams.get("code_challenge")).toBe(challenge);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");

    vi.unstubAllEnvs();
  });

  it("computes the S256 challenge as base64url(SHA256(verifier))", () => {
    const verifier = "some-verifier-value";
    const expected = createHash("sha256")
      .update(verifier, "ascii")
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

    expect(createPKCEChallenge(verifier)).toBe(expected);
  });

  it("produces a fresh verifier with no base64 padding on every call", () => {
    const a = createPKCEVerifier();
    const b = createPKCEVerifier();

    expect(a).toHaveLength(64);
    expect(a).not.toContain("=");
    expect(a).not.toBe(b);
  });

  it("sends the code_verifier on token exchange when provided", async () => {
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "client-id");
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "client-secret");
    const config = getOAuthConfig("google");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "tok", expires_in: 3600 })
    });
    vi.stubGlobal("fetch", fetchMock);

    await exchangeAuthorizationCode(config, "auth-code", "my-verifier");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(requestInit.method).toBe("POST");
    const body = requestInit.body?.toString() ?? "";
    expect(body).toContain("grant_type=authorization_code");
    expect(body).toContain("code=auth-code");
    expect(body).toContain("code_verifier=my-verifier");

    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts refresh_token grant requests", async () => {
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "client-id");
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "client-secret");
    const config = getOAuthConfig("google");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "next-token", expires_in: 3600 })
    });
    vi.stubGlobal("fetch", fetchMock);

    await refreshOAuthToken(config, "refresh-token");

    expect(fetchMock).toHaveBeenCalled();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});
