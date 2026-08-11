import { McpClient } from "../../plugins/mcp-client.js";
import { loadConfig } from "../../storage/config.js";

export interface McpOptions {
  /** Verify (start) a specific server and list its tools. */
  verify?: string;
}

/** List configured MCP servers from config.toml. */
export function listMcpServers(): Array<{ name: string; command: string; args: string[] }> {
  const config = loadConfig();
  return Object.entries(config.mcp?.servers ?? {}).map(([name, server]) => ({
    name,
    command: server.command,
    args: server.args ?? [],
  }));
}

/** Start a server and list its discovered tools. */
export async function verifyMcpServer(name: string): Promise<string[]> {
  const config = loadConfig();
  const server = config.mcp?.servers?.[name];
  if (!server) {
    throw new Error(`MCP server "${name}" is not configured.`);
  }

  const client = new McpClient(name, { command: server.command, args: server.args ?? [], env: server.env });
  await client.start();
  return client.getTools().map((tool) => tool.name);
}

export async function runMcpCommand(options: McpOptions = {}): Promise<void> {
  if (options.verify) {
    try {
      const tools = await verifyMcpServer(options.verify);
      console.log(`MCP server "${options.verify}": connected (${tools.length} tools)`);
      for (const tool of tools) {
        console.log(`  - ${tool}`);
      }
      return;
    } catch (err) {
      console.error(`MCP server "${options.verify}" failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
      return;
    }
  }

  const servers = listMcpServers();
  if (servers.length === 0) {
    console.log("No MCP servers configured. Add [mcp.servers.<name>] to ~/.zenocli/config.toml.");
    return;
  }

  console.log("Configured MCP servers:");
  for (const server of servers) {
    console.log(`  ${server.name}: ${server.command} ${server.args.join(" ")}`);
  }
  console.log("\nVerify one with: zeno mcp --verify <name>");
}
