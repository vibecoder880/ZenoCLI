import { afterEach, describe, expect, it, vi } from "vitest";
import { pollForDeviceToken, startDeviceAuthorization } from "./device-code.js";

const deviceConfig = {
  deviceUrl: "https://example.com/device/code",
  tokenUrl: "https://example.com/token",
  clientId: "client-123",
  scope: "openid profile",
};

const deviceResponse = {
  device_code: "device-abc",
  user_code: "USER-CODE",
  verification_uri: "https://example.com/verify",
  expires_in: 1800,
  interval: 5,
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("startDeviceAuthorization", () => {
  it("posts to the device endpoint and parses the codes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => deviceResponse });
    vi.stubGlobal("fetch", fetchMock);

    const result = await startDeviceAuthorization(deviceConfig);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.com/device/code");
    expect(init.method).toBe("POST");
    expect(init.body?.toString()).toContain("client_id=client-123");
    expect(init.body?.toString()).toContain("scope=openid+profile");

    expect(result.deviceCode).toBe("device-abc");
    expect(result.userCode).toBe("USER-CODE");
    expect(result.verificationUri).toBe("https://example.com/verify");
  });

  it("throws a clear error on a failed device request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => "bad" });
    vi.stubGlobal("fetch", fetchMock);

    await expect(startDeviceAuthorization(deviceConfig)).rejects.toThrow(/Device authorization failed/);
  });
});

describe("pollForDeviceToken", () => {
  it("polls and returns the token once authorized", async () => {
    // First response: authorization_pending; second: access token.
    const pending = {
      ok: false,
      status: 400,
      json: async () => ({ error: "authorization_pending" }),
    };
    const success = {
      ok: true,
      json: async () => ({ access_token: "at-1", refresh_token: "rt-1", expires_in: 3600 }),
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(pending).mockResolvedValueOnce(success);
    vi.stubGlobal("fetch", fetchMock);

    const token = await pollForDeviceToken(deviceConfig, "device-abc", 1800, 0.01);

    expect(token.access_token).toBe("at-1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(init.body?.toString()).toContain("grant_type=urn:ietf:params:oauth:grant-type:device_code");
    expect(init.body?.toString()).toContain("device_code=device-abc");
  });

  it("throws when access is denied", async () => {
    const denied = {
      ok: false,
      status: 400,
      json: async () => ({ error: "access_denied" }),
    };
    const fetchMock = vi.fn().mockResolvedValue(denied);
    vi.stubGlobal("fetch", fetchMock);

    await expect(pollForDeviceToken(deviceConfig, "device-abc", 1800, 0.01)).rejects.toThrow(
      /Access denied/
    );
  });
});
