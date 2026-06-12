import { describe, expect, it } from "vitest";
import { detectLspServers, LspClient, LspManager } from "./lsp-client.js";

describe("detectLspServers", () => {
  it("returns empty array for empty project", () => {
    const servers = detectLspServers("/tmp/nonexistent-project-xyz");
    expect(Array.isArray(servers)).toBe(true);
    expect(servers).toHaveLength(0);
  });
});

describe("LspClient", () => {
  it("creates a client with config", () => {
    const client = new LspClient({
      name: "test",
      command: "nonexistent-command",
      extensions: [".ts"],
    });
    expect(client.config.name).toBe("test");
    expect(client.isAlive()).toBe(false);
  });
});

describe("LspManager", () => {
  it("creates a manager", () => {
    const mgr = new LspManager();
    expect(mgr.getClient("foo")).toBeUndefined();
  });

  it("can start and stop gracefully when no servers", async () => {
    const mgr = new LspManager();
    await mgr.startAll("/tmp/nonexistent-project-xyz");
    await mgr.stopAll();
    // No error = pass
  });

  it("returns undefined for unknown client", () => {
    const mgr = new LspManager();
    expect(mgr.getClient("unknown")).toBeUndefined();
  });

  it("returns undefined for unknown file extension", () => {
    const mgr = new LspManager();
    expect(mgr.getClientForFile("test.unknown")).toBeUndefined();
  });
});
