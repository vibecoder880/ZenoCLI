import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listMcpServers } from "./mcp.js";

vi.mock("../../storage/config.js", () => ({
  loadConfig: () => ({
    default: { provider: "openai", model: "gpt-5.6-terra", streaming: true },
    context: { ignore: [] },
    mcp: {
      servers: {
        filesystem: { command: "node", args: ["fs-server.js"] },
        git: { command: "node", args: ["git-server.js"] },
      },
    },
  }),
}));

describe("listMcpServers", () => {
  it("returns configured servers with their commands", () => {
    const servers = listMcpServers();
    expect(servers).toHaveLength(2);
    expect(servers[0]).toEqual({ name: "filesystem", command: "node", args: ["fs-server.js"] });
    expect(servers[1]).toEqual({ name: "git", command: "node", args: ["git-server.js"] });
  });
});

describe("runMcpCommand", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists servers without a verify target", async () => {
    const { runMcpCommand } = await import("./mcp.js");
    await runMcpCommand({});
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Configured MCP servers:"));
  });
});
