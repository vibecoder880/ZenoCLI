import { describe, expect, it, vi } from "vitest";
import { buildAuthorizationUrl, getOAuthConfig } from "./oauth.js";

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
});
