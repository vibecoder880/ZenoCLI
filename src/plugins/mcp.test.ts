import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";

describe("MCP Module (smoke test)", () => {
  const testDir = path.join(os.tmpdir(), `.neuro-test-mcp-${Date.now()}`);

  beforeEach(() => {
    process.env.HOME = testDir;
    process.env.USERPROFILE = testDir;
  });

  afterEach(() => {
    delete process.env.HOME;
    delete process.env.USERPROFILE;
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("exports expected types and classes", async () => {
    const mod = await import("./mcp-client.js");
    expect(typeof mod.McpClient).toBe("function");
    expect(typeof mod.McpManager).toBe("function");
  });

  it("mcpToolName namespaces server and tool", async () => {
    const { mcpToolName } = await import("./mcp-tools.js");
    expect(mcpToolName("server1", "tool1")).toBe("mcp__server1__tool1");
    expect(mcpToolName("my-server", "my_tool")).toBe("mcp__my-server__my_tool");
  });
});
