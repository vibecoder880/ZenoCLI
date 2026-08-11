/**
 * MCP Registry — wire config [mcp.servers] into the tool registry.
 *
 * Starts each configured MCP server via the stdio McpClient, discovers its
 * tools, and registers them as `mcp__<server>__<tool>` tool definitions so the
 * agent loop can call them. Servers are started lazily; failures are logged and
 * skipped so a broken server never blocks startup.
 */

import { McpClient, type McpServerConfig } from "./mcp-client.js";
import { registerTool } from "../agent/tool-registry.js";
import type { ZenoConfig } from "../storage/config.js";

/** Start all configured MCP servers and register their tools. */
export async function registerMcpServers(config: ZenoConfig): Promise<McpClient[]> {
  const servers = config.mcp?.servers ?? {};
  const clients: McpClient[] = [];

  for (const [name, serverConfig] of Object.entries(servers)) {
    const client = new McpClient(name, serverConfig as McpServerConfig);
    try {
      await client.start();
      registerServerTools(client);
      clients.push(client);
      console.error(`[mcp] connected ${name} (${client.getTools().length} tools)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[mcp] failed to start "${name}": ${message}`);
    }
  }

  return clients;
}

/** Register each discovered tool as `mcp__<server>__<tool>`. */
function registerServerTools(client: McpClient): void {
  for (const tool of client.getTools()) {
    const name = `mcp__${client.name}__${tool.name}`;
    registerTool({
      name,
      description: tool.description ?? `MCP tool ${tool.name} from ${client.name}`,
      parameters: {
        type: "object",
        properties: (tool.inputSchema.properties ?? {}) as Record<string, {
          type: string;
          description: string;
          enum?: string[];
          default?: unknown;
        }>,
        required: tool.inputSchema.required ?? [],
      },
      safety: "moderate",
      category: "exec",
      async execute(params) {
        const result = await client.callTool(tool.name, params as Record<string, unknown>);
        return { output: result };
      },
    });
  }
}
