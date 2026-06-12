/**
 * LSP (Language Server Protocol) Client — connect to language servers.
 *
 * Provides: diagnostics, go-to-definition, find-references, hover.
 * Auto-detect language server từ project files (tsconfig.json, pyproject.toml, etc.)
 */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";

// ---- Types ----

export interface LspServerConfig {
  /** Server command. */
  command: string;
  /** Server arguments. */
  args?: string[];
  /** File extensions this server handles. */
  extensions: string[];
  /** Server display name. */
  name: string;
}

export interface Diagnostic {
  /** File URI. */
  uri: string;
  /** Severity: 1=Error, 2=Warning, 3=Information, 4=Hint. */
  severity: number;
  /** Range: [startLine, startCol, endLine, endCol]. */
  range: [number, number, number, number];
  /** Diagnostic message. */
  message: string;
  /** Optional error code. */
  code?: string | number;
  /** Optional source. */
  source?: string;
}

export interface Location {
  uri: string;
  range: [number, number, number, number];
}

export interface Hover {
  contents: string;
  range?: [number, number, number, number];
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

// ---- Auto-detection ----

/** Auto-detect language servers based on project files. */
export function detectLspServers(cwd: string): LspServerConfig[] {
  const servers: LspServerConfig[] = [];

  // TypeScript: tsconfig.json
  if (existsSync(`${cwd}/tsconfig.json`)) {
    servers.push({
      name: "typescript",
      command: "typescript-language-server",
      args: ["--stdio"],
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    });
  }

  // Python: pyproject.toml or setup.py
  if (existsSync(`${cwd}/pyproject.toml`) || existsSync(`${cwd}/setup.py`)) {
    servers.push({
      name: "python",
      command: "pylsp",
      args: [],
      extensions: [".py"],
    });
  }

  // Rust: Cargo.toml
  if (existsSync(`${cwd}/Cargo.toml`)) {
    servers.push({
      name: "rust",
      command: "rust-analyzer",
      args: [],
      extensions: [".rs"],
    });
  }

  // Go: go.mod
  if (existsSync(`${cwd}/go.mod`)) {
    servers.push({
      name: "go",
      command: "gopls",
      args: [],
      extensions: [".go"],
    });
  }

  return servers;
}

// ---- LSP Client ----

export class LspClient {
  private process: ChildProcess | null = null;
  private nextId = 1;
  private pendingRequests = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  }>();
  private initialized = false;
  private diagnostics = new Map<string, Diagnostic[]>();
  private buffer = "";

  constructor(public readonly config: LspServerConfig) {}

  /** Start the LSP server. */
  async start(cwd: string): Promise<void> {
    if (this.process) return;

    this.process = spawn(this.config.command, this.config.args ?? [], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd,
    });

    this.process.stdout?.on("data", (data: Buffer) => {
      this.buffer += data.toString("utf8");
      this.processBuffer();
    });

    this.process.stderr?.on("data", () => {
      // LSP servers log to stderr — silently consume
    });

    this.process.on("exit", () => {
      this.process = null;
      this.initialized = false;
    });

    // Initialize handshake
    await this.initialize(cwd);
  }

  /** Stop the LSP server. */
  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
      this.initialized = false;
    }
  }

  /** Check if the server is alive. */
  isAlive(): boolean {
    return this.process !== null && !this.process.killed;
  }

  /** Get diagnostics for a file. */
  async getDiagnostics(fileUri: string): Promise<Diagnostic[]> {
    if (!this.initialized) return [];
    return this.diagnostics.get(fileUri) ?? [];
  }

  /** Notify server that a file changed. */
  async didChange(fileUri: string, content: string): Promise<void> {
    if (!this.initialized) return;

    await this.sendNotification("textDocument/didOpen", {
      textDocument: { uri: fileUri, languageId: "typescript", version: 1, text: content },
    });
  }

  /** Go to definition. */
  async goToDefinition(fileUri: string, line: number, col: number): Promise<Location | null> {
    if (!this.initialized) return null;

    const result = await this.sendRequest("textDocument/definition", {
      textDocument: { uri: fileUri },
      position: { line, character: col },
    }) as Location | Location[] | null;

    if (Array.isArray(result)) return result[0] ?? null;
    return result;
  }

  /** Find references. */
  async findReferences(fileUri: string, line: number, col: number, includeDeclaration = false): Promise<Location[]> {
    if (!this.initialized) return [];

    const result = await this.sendRequest("textDocument/references", {
      textDocument: { uri: fileUri },
      position: { line, character: col },
      context: { includeDeclaration },
    }) as Location[] | null;

    return result ?? [];
  }

  /** Get hover info. */
  async getHover(fileUri: string, line: number, col: number): Promise<Hover | null> {
    if (!this.initialized) return null;

    const result = await this.sendRequest("textDocument/hover", {
      textDocument: { uri: fileUri },
      position: { line, character: col },
    }) as Hover | null;

    return result;
  }

  // ---- Private ----

  private async initialize(cwd: string): Promise<void> {
    const rootUri = `file://${cwd}`;

    await this.sendRequest("initialize", {
      processId: process.pid,
      rootUri,
      capabilities: {
        textDocument: {
          synchronization: { didOpen: true, didChange: true },
          definition: { linkSupport: true },
          references: {},
          hover: { contentFormat: ["plaintext", "markdown"] },
        },
      },
    });

    await this.sendNotification("initialized", {});
    this.initialized = true;
  }

  private processBuffer(): void {
    // LSP uses Content-Length headers
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;

      const header = this.buffer.slice(0, headerEnd);
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }

      const contentLength = Number(match[1]);
      const messageStart = headerEnd + 4;
      if (this.buffer.length < messageStart + contentLength) return;

      const body = this.buffer.slice(messageStart, messageStart + contentLength);
      this.buffer = this.buffer.slice(messageStart + contentLength);

      try {
        const response = JSON.parse(body) as JsonRpcResponse;
        this.handleResponse(response);
      } catch {
        // ignore parse errors
      }
    }
  }

  private handleResponse(response: JsonRpcResponse): void {
    if (response.id !== undefined) {
      const pending = this.pendingRequests.get(response.id);
      if (pending) {
        this.pendingRequests.delete(response.id);
        if (response.error) {
          pending.reject(new Error(response.error.message));
        } else {
          pending.resolve(response.result);
        }
      }
    }
  }

  private sendRequest(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pendingRequests.set(id, { resolve, reject });

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`LSP timeout: ${method}`));
        }
      }, 10000);

      const message: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };
      this.sendMessage(message);
    });
  }

  private sendNotification(method: string, params: unknown): void {
    this.sendMessage({ jsonrpc: "2.0", id: this.nextId++, method, params });
  }

  private sendMessage(message: JsonRpcRequest): void {
    if (!this.process?.stdin) return;

    const body = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n`;
    this.process.stdin.write(header + body);
  }
}

// ---- LSP Manager ----

/** Manages multiple LSP clients. */
export class LspManager {
  private clients = new Map<string, LspClient>();

  /** Start all detected LSP servers. */
  async startAll(cwd: string): Promise<void> {
    const configs = detectLspServers(cwd);

    for (const config of configs) {
      try {
        const client = new LspClient(config);
        await client.start(cwd);
        this.clients.set(config.name, client);
      } catch {
        // Server not available — skip
      }
    }
  }

  /** Get a client by name. */
  getClient(name: string): LspClient | undefined {
    return this.clients.get(name);
  }

  /** Get client for a file URI. */
  getClientForFile(filePath: string): LspClient | undefined {
    const ext = filePath.slice(filePath.lastIndexOf("."));
    for (const client of this.clients.values()) {
      if (client.config.extensions.includes(ext)) {
        return client;
      }
    }
    return undefined;
  }

  /** Stop all servers. */
  async stopAll(): Promise<void> {
    await Promise.all(
      Array.from(this.clients.values()).map((c) => c.stop()),
    );
    this.clients.clear();
  }
}
