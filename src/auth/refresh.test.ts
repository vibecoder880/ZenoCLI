import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { AuthProfileStore } from "./auth-profiles.js";
import { isOAuthNearExpiry } from "./auth-profiles.js";
import { refreshOAuthIfNeeded } from "./refresh.js";

const tempHome = path.join(os.tmpdir(), `.zeno-test-refresh-${Date.now()}`);
// A provider with a known OAuth config that works without env (google needs env;
// openai also needs env). We drive a near-expiry oauth profile and stub fetch,
// so getOAuthConfig must still resolve — google requires GOOGLE_OAUTH_CLIENT_ID.
beforeEach(() => {
  rmSync(tempHome, { recursive: true, force: true });
  vi.stubEnv("HOME", tempHome);
  vi.stubEnv("USERPROFILE", tempHome);
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "client-id");
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "client-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  rmSync(tempHome, { recursive: true, force: true });
});

function makeStore() {
  const store = new AuthProfileStore();
  const now = Date.now();
  store.saveProfile({
    type: "oauth",
    provider: "google",
    access: "old-access-token",
    refresh: "refresh-token-abc",
    expires: now + 60_000, // 1 minute from now → within the 3-day buffer
    email: "u@example.com"
  });
  return store;
}

describe("refreshOAuthIfNeeded", () => {
  it("refreshes a near-expiry OAuth token via refresh_token grant", async () => {
    const store = makeStore();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "new-access-token", expires_in: 3600 })
    });
    vi.stubGlobal("fetch", fetchMock);

    const didRefresh = await refreshOAuthIfNeeded(store, "google");

    expect(didRefresh).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(requestInit.method).toBe("POST");
    expect(requestInit.body?.toString()).toContain("grant_type=refresh_token");
    expect(requestInit.body?.toString()).toContain("refresh_token=refresh-token-abc");

    const active = store.getActiveProfile("google");
    expect(active?.type === "oauth" && active.access).toBe("new-access-token");
    expect(active?.type === "oauth" && active.expires).toBeGreaterThan(Date.now() + 3_000_000);
  });

  it("does not refresh when the token is far from expiry", async () => {
    const store = new AuthProfileStore();
    const now = Date.now();
    store.saveProfile({
      type: "oauth",
      provider: "google",
      access: "fresh-access-token",
      refresh: "refresh-token-abc",
      expires: now + 30 * 24 * 60 * 60 * 1000, // 30 days out
      email: "u@example.com"
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const didRefresh = await refreshOAuthIfNeeded(store, "google");

    expect(didRefresh).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    const active = store.getActiveProfile("google");
    expect(active?.type === "oauth" && active.access).toBe("fresh-access-token");
  });

  it("degrades gracefully when the refresh request fails", async () => {
    const store = makeStore();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => "invalid_grant" })
    );

    const didRefresh = await refreshOAuthIfNeeded(store, "google");

    expect(didRefresh).toBe(false);
    // Stored token untouched — caller keeps using it.
    const active = store.getActiveProfile("google");
    expect(active?.type === "oauth" && active.access).toBe("old-access-token");
  });

  it("does nothing when there is no OAuth profile", async () => {
    const store = new AuthProfileStore();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await refreshOAuthIfNeeded(store, "google")).toBe(false);
  });
});

describe("isOAuthNearExpiry", () => {
  const base = { id: "google:u", provider: "google", access: "a", refresh: "r" } as const;
  const now = Date.now();

  it("is true within the buffer", () => {
    expect(
      isOAuthNearExpiry({
        ...base,
        type: "oauth",
        expires: now + 60_000,
        createdAt: now,
        updatedAt: now
      })
    ).toBe(true);
  });

  it("is false when far from expiry", () => {
    expect(
      isOAuthNearExpiry({
        ...base,
        type: "oauth",
        expires: now + 30 * 24 * 60 * 60 * 1000,
        createdAt: now,
        updatedAt: now
      })
    ).toBe(false);
  });

  it("is false when already expired", () => {
    expect(
      isOAuthNearExpiry({
        ...base,
        type: "oauth",
        expires: now - 1,
        createdAt: now,
        updatedAt: now
      })
    ).toBe(false);
  });
});