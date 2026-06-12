/**
 * MCP Tool Integration — registers MCP tools with the ToolRegistry.
 *
 * Tool names are namespaced: mcp__{serverName}__{toolName}
 * Schema loading is deferred until first use (lazy).
 */

import type { ToolDefinition, ToolResult } from "../agent/tool-registry.js";
import { registerTool } from "../agent/tool-registry.js";
import type { McpManager } from "./mcp-client.js";

/** Create a namespaced tool name for an MCP tool. */
export function mcpToolName(serverName: string, toolName: string): string {
  return `mcp__${serverName}__${toolName}`;
}

/** Create ToolDefinition wrappers for all MCP tools and register them. */
export function registerMcpTools(manager: McpManager): void {
  const allTools = manager.getAllTools();

  for (const { serverName, tool } of allTools) {
    const namespacedName = mcpToolName(serverName, tool.name);

    const definition: ToolDefinition = {
      name: namespacedName,
      description: tool.description ?? `MCP tool: ${tool.name} (from ${serverName})`,
      category: "web", // MCP tools are external
      safety: "moderate",
      parameters: tool.inputSchema as ToolDefinition["parameters"],
      execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
        const client = manager.getClient(serverName);
        if (!client) {
          return { output: "", error: `MCP server "${serverName}" is not connected.` };
        }

        try {
          const result = await client.callTool(tool.name, params);
          return { output: result };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return { output: "", error: `MCP tool error: ${message}` };
        }
      },
    };

    registerTool(definition);
  }
}
