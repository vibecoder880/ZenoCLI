/**
 * Execution tools: run_command with enhanced safety and timeout.
 *
 * Safety model: instead of a fragile regex denylist, tokenize the command
 * and reject two real failure modes:
 *   1. recursive/force delete targets that reference absolute paths or
 *      shell metacharacter expansion (* .,  ~, $TMP, .., etc.) — these are
 *      how `rm -rf /` and its variants slip past a literal "/" check.
 *   2. interpreter one-liners (sh/python/node/perl/... -c/-e) that wrap a
 *      system()/remove call, which hides destructive commands from any
 *      command-line scan.
 * Plain `rm -rf <plain-relative-path>` inside the workspace (e.g. a build
 * dir) is still allowed.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { analyzeCommand } from "../../safety/shell-ast.js";
import type { ToolDefinition, ToolExecutionContext, ToolResult } from "../tool-registry.js";

const execAsync = promisify(exec);

/**
 * Reject destructive commands.
 *
 * Delegates to the shared shell-AST analyzer in `src/safety/shell-ast.ts`
 * so `run_command` and the auto-mode classifier use a single rule set.
 * Conservative by construction: recursive deletes of a non-plain target and
 * interpreter one-liners wrapping destructive calls are blocked; ordinary
 * relative `rm -rf dist/` and benign interpreter usage are preserved.
 */
export function ensureSafeCommand(command: string): void {
  const analysis = analyzeCommand(command);
  if (analysis.blocked) {
    const reason = analysis.reasons[0] ?? "unsafe command";
    throw new Error(`Command blocked by safety policy: ${command} (${reason})`);
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