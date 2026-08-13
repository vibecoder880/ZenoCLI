/**
 * MCP (Model Context Protocol) Client — connect to MCP servers via stdio transport.
 *
 * Discovers tools, resources, and prompts from MCP servers.
 * Lazy-loads tool schemas (only when tool is invoked).
 * Forwards MCP tool calls and returns results.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { createInterface, type Interface } from "node:readline";
import { randomUUID } from "node:crypto";

// ---- Types ----

export interface McpServerConfig {
  /** Command to start the MCP server (e.g., "node"). */
  command: string;
  /** Arguments for the command. */
  args?: string[];
  /** Environment variables for the server process. */
  env?: Record<string, string>;
}

export interface McpToolSchema {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// ---- MCP Client ----

export class McpClient {
  private process: ChildProcess | null = null;
  private readline: Interface | null = null;
  private pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  }>();
  private tools: McpToolSchema[] = [];
  private resources: McpResource[] = [];
  private started = false;
  private retries = 0;
  private readonly maxRetries = 3;

  constructor(
    readonly name: string,
    private readonly config: McpServerConfig,
  ) {}

  /** Start the MCP server process and initialize. */
  async start(): Promise<void> {
    if (this.started) return;

    this.process = spawn(this.config.command, this.config.args ?? [], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...this.config.env },
    });

    this.readline = createInterface({ input: this.process.stdout! });

    // Handle responses
    this.readline.on("line", (line) => {
      try {
        const response = JSON.parse(line) as JsonRpcResponse;
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          this.pendingRequests.delete(response.id);
          if (response.error) {
            pending.reject(new Error(response.error.message));
          } else {
            pending.resolve(response.result);
          }
        }
      } catch {
        // Ignore non-JSON lines
      }
    });

    // Handle stderr
    this.process.stderr?.on("data", (data: Buffer) => {
      // Log but don't fail
      const msg = data.toString().trim();
      if (msg) {
        console.error(`[MCP:${this.name}] ${msg}`);
      }
    });

    // Handle process exit
    this.process.on("exit", (code) => {
      this.started = false;
      if (code !== 0 && this.retries < this.maxRetries) {
        this.retries++;
        // Auto-restart
        setTimeout(() => void this.start(), 1000 * this.retries);
      }
    });

    // Send initialize request
    await this.sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "zenocli", version: "0.3.0" },
    });

    // Send initialized notification
    this.sendNotification("notifications/initialized", {});

    // Discover tools and resources
    await this.discover();

    this.started = true;
    this.retries = 0;
  }

  /** Discover available tools and resources from the server. */
  private async discover(): Promise<void> {
    try {
      const toolsResult = await this.sendRequest("tools/list", {}) as { tools?: McpToolSchema[] };
      this.tools = toolsResult?.tools ?? [];
    } catch {
      this.tools = [];
    }

    try {
      const resourcesResult = await this.sendRequest("resources/list", {}) as { resources?: McpResource[] };
      this.resources = resourcesResult?.resources ?? [];
    } catch {
      this.resources = [];
    }
  }

  /** Get discovered tools. */
  getTools(): McpToolSchema[] {
    return this.tools;
  }

  /** Get discovered resources. */
  getResources(): McpResource[] {
    return this.resources;
  }

  /** Invoke a tool on the MCP server. */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<string> {
    const result = await this.sendRequest("tools/call", {
      name: toolName,
      arguments: args,
    }) as {
      content?: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };

    if (result.isError) {
      throw new Error(`MCP tool error: ${JSON.stringify(result.content)}`);
    }

    // Extract text from content
    return result.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n") ?? "";
  }

  /** Graceful shutdown. */
  async stop(): Promise<void> {
    if (!this.process) return;
    this.started = false;
    this.process.kill("SIGTERM");
    this.process = null;
    this.readline?.close();
    this.readline = null;
  }

  /** Check if the server is alive. */
  isAlive(): boolean {
    return this.started && this.process !== null && !this.process.killed;
  }

  // ---- JSON-RPC ----

  private sendRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      const request: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };

      this.pendingRequests.set(id, { resolve, reject });

      // Timeout after 30s
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`MCP request timeout: ${method}`));
        }
      }, 30000);

      this.process?.stdin?.write(JSON.stringify(request) + "\n");
    });
  }

  private sendNotification(method: string, params: Record<string, unknown>): void {
    const notification = { jsonrpc: "2.0", method, params };
    this.process?.stdin?.write(JSON.stringify(notification) + "\n");
  }
}

// ---- MCP Manager ----

/** Manages multiple MCP server connections. */
export class McpManager {
  private clients = new Map<string, McpClient>();

  /** Add and start an MCP server. */
  async addServer(name: string, config: McpServerConfig): Promise<McpClient> {
    const client = new McpClient(name, config);
    this.clients.set(name, client);
    await client.start();
    return client;
  }

  /** Get a client by name. */
  getClient(name: string): McpClient | undefined {
    return this.clients.get(name);
  }

  /** Get all clients. */
  getAllClients(): McpClient[] {
    return Array.from(this.clients.values());
  }

  /** Get all tools from all servers. */
  getAllTools(): Array<{ serverName: string; tool: McpToolSchema }> {
    const result: Array<{ serverName: string; tool: McpToolSchema }> = [];
    for (const [name, client] of this.clients) {
      for (const tool of client.getTools()) {
        result.push({ serverName: name, tool });
      }
    }
    return result;
  }

  /** Stop all servers. */
  async stopAll(): Promise<void> {
    await Promise.all(
      Array.from(this.clients.values()).map((client) => client.stop()),
    );
    this.clients.clear();
  }
}
