import { describe, expect, it, vi } from "vitest";
import { buildAuthorizationUrl, getOAuthConfig, refreshOAuthToken } from "./oauth.js";

describe("oauth config", () => {
  it("builds a google auth url", () => {
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "client-id");
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "client-secret");

    const config = getOAuthConfig("google");
    const url = new URL(buildAuthorizationUrl(config, "state-123"));

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("state")).toBe("state-123");

    vi.unstubAllEnvs();
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
