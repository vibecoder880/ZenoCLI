import { describe, expect, it } from "vitest";
import http from "node:http";
import { waitForOAuthCode } from "./oauth-server.js";

/** Find a free localhost port so tests don't collide. */
function getFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 9876;
      server.close(() => resolve(port));
    });
  });
}

function get(port: number, path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port, path }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      })
      .on("error", reject);
  });
}

describe("waitForOAuthCode", () => {
  it("resolves the authorization code when state matches", async () => {
    const port = await getFreePort();
    const promise = waitForOAuthCode("expected-state-123", port, 5_000);

    const status = await get(port, "/callback?code=CODE_ABC&state=expected-state-123");
    expect(status).toBe(200);

    await expect(promise).resolves.toBe("CODE_ABC");
  });

  it("rejects login when the state parameter is missing", async () => {
    const port = await getFreePort();
    const promise = waitForOAuthCode("expected-state-123", port, 5_000);

    const status = await get(port, "/callback?code=CODE_ABC");
    expect(status).toBe(400);

    await expect(promise).rejects.toThrow(/state mismatch/);
  });

  it("rejects login when the state parameter does not match", async () => {
    const port = await getFreePort();
    const promise = waitForOAuthCode("expected-state-123", port, 5_000);

    const status = await get(port, "/callback?code=CODE_ABC&state=attacker-state");
    expect(status).toBe(400);

    await expect(promise).rejects.toThrow(/state mismatch/);
  });
});