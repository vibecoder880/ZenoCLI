import { describe, expect, it, vi } from "vitest";
import { registerMcpServers } from "./mcp-registry.js";
import type { McpToolSchema } from "./mcp-client.js";
import { getTool } from "../agent/tool-registry.js";

vi.mock("./mcp-client.js", () => {
  class FakeMcpClient {
    readonly name: string;
    constructor(name: string) {
      this.name = name;
    }
    started = false;
    private tools: McpToolSchema[] = [];
    async start(): Promise<void> {
      this.started = true;
      this.tools = [
        {
          name: "read_file",
          description: "Read a file",
          inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
        },
      ];
    }
    getTools(): McpToolSchema[] {
      return this.tools;
    }
    async callTool(): Promise<string> {
      return "ok";
    }
  }
  return { McpClient: FakeMcpClient };
});

describe("registerMcpServers", () => {
  it("starts configured servers and registers their tools", async () => {
    const config = {
      mcp: { servers: { "test-server": { command: "node", args: ["server.js"] } } },
    } as never;

    await registerMcpServers(config);

    // The mcp__test-server__read_file tool should now be registered.
    expect(getTool("mcp__test-server__read_file")).toBeDefined();
  });
});