/**
 * Safety Classifier — rule-based classifier to evaluate tool calls before execution.
 * Used in "auto" permission mode.
 *
 * Blocks: downloading/executing unknown code, sending data externally, mass deletion, force push
 * Allows: local file operations, dependency installs, read-only HTTP
 */

import { isProtectedPath } from "./permissions.js";
import { analyzeCommand } from "./shell-ast.js";

// ---- Types ----

export interface SafetyVerdict {
  /** Whether the action is allowed. */
  allowed: boolean;
  /** Reason for blocking (if blocked). */
  reason?: string;
  /** Risk level: low, medium, high. */
  risk: "low" | "medium" | "high";
}

// ---- Block Rules ----

interface BlockRule {
  /** Tool name this rule applies to (or "*" for all). */
  tool: string | "*";
  /** Description of what is blocked. */
  description: string;
  /** Check function. Returns reason if blocked, null if allowed. */
  check: (params: Record<string, unknown>, cwd?: string) => string | null;
}

const BLOCK_RULES: BlockRule[] = [
  // run_command: block destructive commands via the shared shell-AST analyzer
  {
    tool: "run_command",
    description: "Block destructive shell commands",
    check: (params) => {
      const cmd = String(params.cmd ?? "");
      const analysis = analyzeCommand(cmd);
      if (analysis.blocked) {
        return analysis.reasons[0] ?? "Command blocked by safety policy";
      }
      return null;
    },
  },

  // write_file/edit_file: block writes to protected paths
  {
    tool: "write_file",
    description: "Block writes to protected paths",
    check: (params) => {
      const filePath = String(params.path ?? "");
      if (isProtectedPath(filePath)) {
        return `Writing to protected path "${filePath}" requires approval`;
      }
      return null;
    },
  },
  {
    tool: "edit_file",
    description: "Block edits to protected paths",
    check: (params) => {
      const filePath = String(params.path ?? "");
      if (isProtectedPath(filePath)) {
        return `Editing protected path "${filePath}" requires approval`;
      }
      return null;
    },
  },

  // run_command: allow dependency installs
  // (No block rule needed — npm install, pip install are allowed)
];

// ---- Allow Rules ----

interface AllowRule {
  tool: string | "*";
  description: string;
  check: (params: Record<string, unknown>) => boolean;
}

const ALLOW_RULES: AllowRule[] = [
  // Read-only tools are always allowed
  {
    tool: "*",
    description: "Read-only tools are always safe",
    check: () => false, // Handled by safety level check below
  },
  // npm install variations
  {
    tool: "run_command",
    description: "Dependency installs are safe",
    check: (params) => {
      const cmd = String(params.cmd ?? "").trim();
      return /^(?:npm\s+install|npm\s+i\s|pip\s+install|yarn\s+add|pnpm\s+add)/i.test(cmd);
    },
  },
  // Git read operations
  {
    tool: "run_command",
    description: "Git read operations are safe",
    check: (params) => {
      const cmd = String(params.cmd ?? "").trim();
      return /^(?:git\s+(?:status|log|diff|branch|show|ls-files|remote))/i.test(cmd);
    },
  },
  // Test/lint commands
  {
    tool: "run_command",
    description: "Test and lint commands are safe",
    check: (params) => {
      const cmd = String(params.cmd ?? "").trim();
      return /^(?:npm\s+test|npm\s+run|vitest|jest|eslint|tsc)/i.test(cmd);
    },
  },
];

const SAFE_TOOLS = new Set(["read_file", "list_dir", "glob", "grep", "web_search", "web_fetch", "ask_user"]);

// ---- Main Classifier ----

/**
 * Classify a tool call for safety. Used in "auto" permission mode.
 * Returns a SafetyVerdict indicating whether the call is allowed.
 */
export function classifySafety(
  toolName: string,
  params: Record<string, unknown>,
  cwd?: string,
): SafetyVerdict {
  // Read-only tools are always safe
  if (SAFE_TOOLS.has(toolName)) {
    return { allowed: true, risk: "low" };
  }

  // Check explicit allow rules
  for (const rule of ALLOW_RULES) {
    if (rule.tool === toolName || rule.tool === "*") {
      if (rule.check(params)) {
        return { allowed: true, risk: "low" };
      }
    }
  }

  // Check block rules
  for (const rule of BLOCK_RULES) {
    if (rule.tool === toolName || rule.tool === "*") {
      const blockReason = rule.check(params, cwd);
      if (blockReason) {
        return { allowed: false, reason: blockReason, risk: "high" };
      }
    }
  }

  // File operations are medium risk
  if (toolName === "write_file" || toolName === "edit_file") {
    return { allowed: true, risk: "medium" };
  }

  // Shell commands: blocked verdict comes from the shared shell-AST
  // analyzer (block rule above). Non-blocked commands stay medium risk by
  // default so auto mode still prompts conservatively.
  if (toolName === "run_command") {
    return { allowed: true, risk: "medium" };
  }

  // Unknown tools: allow but flag as medium risk
  return { allowed: true, risk: "medium" };
}
