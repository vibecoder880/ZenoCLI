/**
 * Execution tools: run_command with enhanced safety and timeout.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ToolDefinition, ToolExecutionContext, ToolResult } from "../tool-registry.js";

const execAsync = promisify(exec);

const FORBIDDEN_PATTERNS = [
  /\brm\s+-rf\s+\//i,
  /\bdel\s+\/[sf]\s+[a-z]:\\/i,
  /\brmdir\s+\/[qs]\s+/i,
  /\bgit\s+push\s+--force/i,
  /\bgit\s+reset\s+--hard\s+origin/i,
  /\bformat\s+[a-z]:/i,
  /\bdd\s+if=/i,
];

function ensureSafeCommand(command: string): void {
  if (FORBIDDEN_PATTERNS.some((pattern) => pattern.test(command))) {
    throw new Error(`Command blocked by safety policy: ${command}`);
  }
}

const runCommandTool: ToolDefinition = {
  name: "run_command",
  description: "Run a shell command in the project directory. Has safety guards against destructive commands.",
  category: "exec",
  safety: "dangerous",
  parameters: {
    type: "object",
    properties: {
      cmd: { type: "string", description: "Shell command to execute." },
      timeout: { type: "number", description: "Timeout in milliseconds (default: 30000, max: 120000)." },
    },
    required: ["cmd"],
  },
  async execute(params, ctx: ToolExecutionContext): Promise<ToolResult> {
    const command = String(params.cmd ?? "");
    const timeout = Math.min(Number(params.timeout) || 30000, 120000);

    if (!command) {
      return { output: "", error: "Command is required." };
    }

    ensureSafeCommand(command);

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: ctx.cwd,
        timeout,
        maxBuffer: 1024 * 1024,
      });

      const parts = [stdout.trim(), stderr.trim()].filter(Boolean);
      return { output: parts.join("\n") || "(no output)" };
    } catch (err: unknown) {
      const execErr = err as { stdout?: string; stderr?: string; message?: string };
      const parts = [
        execErr.stdout?.trim(),
        execErr.stderr?.trim(),
        execErr.message,
      ].filter(Boolean);
      return { output: parts.join("\n"), error: "Command failed with exit code" };
    }
  },
};

// ---- Export all definitions ----

export const execToolDefinitions: ToolDefinition[] = [
  runCommandTool,
];
