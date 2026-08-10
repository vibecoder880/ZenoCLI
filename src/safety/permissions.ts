/**
 * Permission System — 6 permission modes for controlling tool execution.
 *
 * Modes (cycle with Shift+Tab in TUI):
 *   default           - Reads only, prompt for everything else
 *   acceptEdits       - Reads + file edits + filesystem commands auto-approved
 *   plan              - Read-only exploration mode
 *   auto              - Everything with background safety classifier
 *   dontAsk           - Only pre-approved tools
 *   bypassPermissions - Everything (dangerous, container-only)
 */

export type PermissionMode = "default" | "acceptEdits" | "plan" | "auto" | "dontAsk" | "bypassPermissions";

export const ALL_PERMISSION_MODES: PermissionMode[] = [
  "default",
  "acceptEdits",
  "plan",
  "auto",
  "dontAsk",
  "bypassPermissions",
];

export interface PermissionPrompt {
  toolName: string;
  params: Record<string, unknown>;
  /** Reason for prompting (if any). */
  reason?: string;
}

export interface PermissionDecision {
  /** Whether to allow the tool call. */
  allow: boolean;
  /** Whether to remember this decision for future calls. */
  alwaysAllow?: boolean;
}

// ---- Protected Paths ----

export const PROTECTED_PATHS = [
  ".git",
  ".zenocli",
  ".zeno",
  ".vscode",
  ".husky",
  ".mcp.json",
  ".bashrc",
  ".zshrc",
  ".profile",
  ".npmrc",
  ".yarnrc",
  ".pre-commit-config.yaml",
];

/** Check if a path is protected. */
export function isProtectedPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return PROTECTED_PATHS.some((p) => normalized.includes(`/${p}`) || normalized.endsWith(p));
}

// ---- Auto-approve rules ----

/** Tools that are always safe (read-only). */
const SAFE_TOOLS = new Set([
  "read_file",
  "list_dir",
  "glob",
  "grep",
  "web_search",
  "web_fetch",
  "ask_user",
]);

/** Tools that modify files (moderate risk). */
const EDIT_TOOLS = new Set([
  "write_file",
  "edit_file",
]);

/** Tools allowed in plan mode (read-only only). */
const PLAN_ALLOWED_TOOLS = new Set([
  "read_file",
  "list_dir",
  "glob",
  "grep",
  "web_search",
  "web_fetch",
  "ask_user",
]);

// ---- Permission Checker ----

export interface PermissionConfig {
  /** Current permission mode. */
  mode: PermissionMode;
  /** Per-tool auto-approve rules from config.toml. */
  autoApprove?: Record<string, boolean>;
}

/**
 * Check whether a tool call should be auto-approved or needs a permission prompt.
 * Returns null if auto-approved, or a PermissionPrompt if user input is needed.
 */
export function checkPermission(
  toolName: string,
  params: Record<string, unknown>,
  config: PermissionConfig,
): PermissionPrompt | null {
  const { mode } = config;

  // bypassPermissions: everything allowed
  if (mode === "bypassPermissions") {
    return null;
  }

  // Check per-tool auto-approve config
  if (config.autoApprove?.[toolName]) {
    return null;
  }

  // All modes allow safe (read-only) tools
  if (SAFE_TOOLS.has(toolName)) {
    return null;
  }

  // plan mode: only read-only tools allowed
  if (mode === "plan") {
    if (!PLAN_ALLOWED_TOOLS.has(toolName)) {
      return {
        toolName,
        params,
        reason: `Tool "${toolName}" is not allowed in plan mode (read-only).`,
      };
    }
    return null;
  }

  // dontAsk: only pre-approved tools
  if (mode === "dontAsk") {
    if (!config.autoApprove?.[toolName]) {
      return {
        toolName,
        params,
        reason: `Tool "${toolName}" is not pre-approved for dontAsk mode.`,
      };
    }
    return null;
  }

  // acceptEdits: auto-approve file edits + filesystem commands
  if (mode === "acceptEdits") {
    if (EDIT_TOOLS.has(toolName)) {
      // Still check protected paths
      const targetPath = String(params.path ?? params.target ?? "");
      if (targetPath && isProtectedPath(targetPath)) {
        return {
          toolName,
          params,
          reason: `Path "${targetPath}" is protected.`,
        };
      }
      return null;
    }
    // Everything else needs permission
    if (!SAFE_TOOLS.has(toolName)) {
      return { toolName, params };
    }
    return null;
  }

  // default: prompt for everything that isn't safe
  if (mode === "default") {
    if (!SAFE_TOOLS.has(toolName)) {
      // Check protected paths for file operations
      const targetPath = String(params.path ?? params.target ?? "");
      if (targetPath && isProtectedPath(targetPath)) {
        return {
          toolName,
          params,
          reason: `Path "${targetPath}" is protected.`,
        };
      }
      return { toolName, params };
    }
    return null;
  }

  // auto: use safety classifier (handled separately in classifier.ts)
  // For now, fall through to prompting
  return { toolName, params };
}

/** Cycle to the next permission mode. */
export function nextPermissionMode(current: PermissionMode): PermissionMode {
  const idx = ALL_PERMISSION_MODES.indexOf(current);
  return ALL_PERMISSION_MODES[(idx + 1) % ALL_PERMISSION_MODES.length];
}

/** Get a human-readable label for a permission mode. */
export function permissionModeLabel(mode: PermissionMode): string {
  const labels: Record<PermissionMode, string> = {
    default: "🔒 Default (prompt for writes)",
    acceptEdits: "✏️ Accept Edits (auto file changes)",
    plan: "🔍 Plan (read-only)",
    auto: "⚡ Auto (with safety classifier)",
    dontAsk: "🤫 Don't Ask (pre-approved only)",
    bypassPermissions: "🔓 Bypass (everything allowed)",
  };
  return labels[mode];
}
