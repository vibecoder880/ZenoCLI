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
import type { ToolDefinition, ToolExecutionContext, ToolResult } from "../tool-registry.js";

const execAsync = promisify(exec);

interface BlockRule {
  /** Regex tested against the whole command. */
  pattern: RegExp;
  reason: string;
}

const BLOCK_RULES: BlockRule[] = [
  // Force pushes / destructive git ops.
  { pattern: /\bgit\s+(?:push|fetch|pull)\s+.*--force(?:-with-lease)?/i, reason: "Force push/pull to a git remote is blocked" },
  { pattern: /\bgit\s+reset\s+--hard\s+(?:origin\/|\/)/, reason: "Hard reset to a remote ref is blocked" },

  // Whole-volume / filesystem-destructive formatting.
  { pattern: /\bformat\s+[a-z]:/i, reason: "Drive formatting is blocked" },
  { pattern: /\bdd\s+if=/i, reason: "Low-level disk writes via dd are blocked" },
  { pattern: /\bshutdown|reboot|poweroff\b/i, reason: "System power commands are blocked" },
  { pattern: /\bkill\s+-9\s+1\b/i, reason: "Killing PID 1 is blocked" },
  { pattern: /\bdocker\s+rm\s+-f\s+/i, reason: "Force container removal is blocked" },
  { pattern: /\bnpm\s+uninstall|npm\s+remove|yarn\s+remove|pnpm\s+remove\b/, reason: "Package removal is blocked" },
  { pattern: /\bnpm\s+publish\b/, reason: "npm publish is blocked" },

  // Windows recursive delete forms.
  { pattern: /\bdel\s+\/[sfq]+\s+[a-zA-Z]:\\/i, reason: "Windows recursive delete is blocked" },
  { pattern: /\brmdir\s+\/[sq]+\s+[a-zA-Z]:\\/i, reason: "Windows recursive delete is blocked" },

  // Data exfiltration to remote hosts.
  { pattern: /\bcurl\s+.*(-d|--data|--data-raw|-X\s+POST|-X\s+PUT|-X\s+PATCH)/i, reason: "Sending data via curl is blocked" },
  { pattern: /\bwget\s+.*--post/i, reason: "Sending data via wget is blocked" },
  { pattern: /\bcurl\s+.*\|\s*(?:ba)?sh/i, reason: "Piping curl output to a shell is blocked" },
  { pattern: /\bwget\s+.*\|\s*(?:ba)?sh/i, reason: "Piping wget output to a shell is blocked" },
];

/** Recursive/force delete commands. */
const DELETE_CMDS = ["rm", "rmdir", "del", "unlink", "del /s", "rmdir /s"];

/** Interpreters whose -c / -e one-liners can wrap arbitrary system calls. */
const INTERPRETERS = /\b(sh|bash|zsh|dash|python|python3|perl|ruby|php|node|nodejs|bash|powershell|pwsh)\s+(-c|-e|--%C|--command)\b/i;

/** Shell expansion characters that can turn a "relative" target absolute. */
const DANGEROUS_TARGET_TOKENS = [/\*/i, /^\.$/, /^~/i, /\$/, /\.\.\//, /^\/+/];

function block(command: string, reason: string): never {
  throw new Error(`Command blocked by safety policy: ${command} (${reason})`);
}

/** Tokenize a shell command on whitespace, keeping quoted segments in place. */
function tokenize(command: string): string[] {
  const tokens: string[] = [];
  const parts = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  // Strip surrounding quotes from each token for inspection.
  for (const part of parts) {
    const stripped = part.startsWith('"') && part.endsWith('"')
      ? part.slice(1, -1)
      : part.startsWith("'") && part.endsWith("'")
        ? part.slice(1, -1)
        : part;
    tokens.push(stripped);
  }
  return tokens;
}

/**
 * Reject destructive commands.
 *
 * Conservative by construction: anything shaped like a recursive deletes of
 * a non-plain, potentially-absolute target is blocked, and any interpreter
 * one-liner that mentions deletion/system/disk targets is blocked. Ordinary
 * relative `rm -rf dist/` and benign interpreter usage (e.g. a build script
 * runner) are preserved.
 */
export function ensureSafeCommand(command: string): void {
  // 1. Whole-command block rules (git force ops, exfiltration, disk-level).
  for (const rule of BLOCK_RULES) {
    if (rule.pattern.test(command)) {
      block(command, rule.reason);
    }
  }

  // 2. Interpreter one-liners that can hide destructive commands.
  const interpMatch = command.match(INTERPRETERS);
  if (interpMatch) {
    const lower = command.toLowerCase();
    const hiddenDestructive =
      /\b(system|popen|exec(?:vp|ve|l|le)?|unlink|remove|rmtree|mkdir_?tree|shutil\.)\b/.test(lower)
      || /\brm\b/.test(lower)
      || /\bdel\b/.test(lower)
      || /(os\.|subprocess\.|child_process\.|fs\.)?\s*(unlink|rm|rmtree|remove)|\bos\.system\b/.test(lower)
      || /file:\/\//i.test(lower);
    if (hiddenDestructive) {
      block(command, "interpreter one-liner that may perform destructive operations is blocked");
    }
  }

  // 3. Recursive/force delete targets.
  const tokens = tokenize(command);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].toLowerCase();

    // Match token to a delete command: "rm", "rmdir", "unlink", "del".
    const isDeleteCmd =
      token === "rm" || token === "unlink" || token === "rmdir" || token === "del";

    if (!isDeleteCmd) {
      continue;
    }

    // Find the flag segment (only "-" prefixed tokens are flags here; Windows
    // "/s" drive forms are already blocked by the whole-command rules above).
    let targetIndex = i + 1;
    while (tokens[targetIndex]?.startsWith("-")) {
      targetIndex++;
    }

    const flags = tokens.slice(i + 1, targetIndex).join("").toLowerCase();
    const isRecursive = flags.includes("r");
    const isForce = flags.includes("f");

    if (!isRecursive && !isForce) {
      // Plain remove of a specific file — not the risk profile we guard.
      continue;
    }

    const target = tokens[targetIndex];
    if (!target) {
      continue;
    }

    // Danger if the target is empty-ish, an expansion, absolute, or traverses up.
    const targetDangerous = DANGEROUS_TARGET_TOKENS.some((re) => re.test(target));
    if (isRecursive && targetDangerous) {
      block(command, `recursive delete of unsafe target "${target}" is blocked`);
    }
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