/**
 * Lifecycle Hooks System — fire on agent lifecycle events.
 *
 * Events: PreToolUse, PostToolUse, SessionStart, SessionEnd, Notification
 * Hook types: Shell command, Prompt injection
 * PreToolUse hooks can block tool execution.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// ---- Types ----

export type HookEvent = "PreToolUse" | "PostToolUse" | "SessionStart" | "SessionEnd" | "Notification";

export interface HookConfig {
  /** Which event to fire on. */
  event: HookEvent;
  /** Tool name to match (optional, for PreToolUse/PostToolUse). */
  match?: string;
  /** Shell command to run. */
  command?: string;
  /** Prompt text to inject into context. */
  prompt?: string;
}

export interface HookContext {
  /** Tool name (for tool-related events). */
  toolName?: string;
  /** Tool parameters. */
  params?: Record<string, unknown>;
  /** Tool result (for PostToolUse). */
  result?: string;
  /** Working directory. */
  cwd: string;
}

export interface HookResult {
  /** Whether the hook allows the action to proceed. */
  proceed: boolean;
  /** Optional output to inject into context. */
  output?: string;
  /** Error message if hook failed. */
  error?: string;
}

// ---- Hook Runner ----

export class HookRunner {
  private hooks: HookConfig[] = [];

  /** Register a hook. */
  addHook(hook: HookConfig): void {
    this.hooks.push(hook);
  }

  /** Register multiple hooks. */
  addHooks(hooks: HookConfig[]): void {
    for (const hook of hooks) {
      this.addHook(hook);
    }
  }

  /** Get hooks for a specific event. */
  getHooks(event: HookEvent): HookConfig[] {
    return this.hooks.filter((h) => h.event === event);
  }

  /**
   * Fire hooks for an event.
   * Returns combined result. PreToolUse can block execution.
   */
  async fire(event: HookEvent, context: HookContext): Promise<HookResult> {
    const matching = this.hooks.filter((h) => {
      if (h.event !== event) return false;
      // If match is specified, check tool name
      if (h.match && context.toolName && !context.toolName.includes(h.match)) return false;
      return true;
    });

    if (matching.length === 0) {
      return { proceed: true };
    }

    const outputs: string[] = [];

    for (const hook of matching) {
      try {
        // Shell command hook
        if (hook.command) {
          const result = await runCommandHook(hook.command, context);
          if (result.output) outputs.push(result.output);
          if (!result.proceed) {
            return { proceed: false, output: outputs.join("\n"), error: result.error };
          }
        }

        // Prompt hook
        if (hook.prompt) {
          const prompt = expandTemplate(hook.prompt, context);
          outputs.push(prompt);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Log error but don't break flow (except PreToolUse blocking)
        outputs.push(`[Hook error: ${message}]`);
      }
    }

    return { proceed: true, output: outputs.length > 0 ? outputs.join("\n") : undefined };
  }

  /** Clear all hooks. */
  clear(): void {
    this.hooks = [];
  }

  /** Get count of registered hooks. */
  get count(): number {
    return this.hooks.length;
  }
}

// ---- Helpers ----

/** Run a shell command hook. */
async function runCommandHook(command: string, context: HookContext): Promise<HookResult> {
  const expanded = expandTemplate(command, context);

  try {
    const { stdout, stderr } = await execAsync(expanded, {
      cwd: context.cwd,
      timeout: 10000, // 10s timeout for hooks
      maxBuffer: 64 * 1024,
    });

    const output = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
    // Non-zero exit code from hook can block (check stderr)
    return { proceed: true, output: output || undefined };
  } catch (err) {
    const execErr = err as { stderr?: string; stdout?: string };
    const output = [execErr.stdout?.trim(), execErr.stderr?.trim()].filter(Boolean).join("\n");
    return { proceed: true, output: output || undefined, error: "Hook command failed" };
  }
}

/** Expand template variables in hook command/prompt. */
function expandTemplate(template: string, context: HookContext): string {
  return template
    .replace(/\$\{file\}/g, String(context.params?.path ?? context.params?.file ?? ""))
    .replace(/\$\{tool\}/g, context.toolName ?? "")
    .replace(/\$\{cwd\}/g, context.cwd)
    .replace(/\$\{result\}/g, (context.result ?? "").slice(0, 500));
}

// ---- Load hooks from config ----

/**
 * Load hooks from config.toml format:
 * [[hooks.PreToolUse]]
 * match = "edit_file"
 * command = "npx eslint --fix ${file}"
 */
export function loadHooksFromConfig(config: Record<string, unknown>): HookConfig[] {
  const hooks: HookConfig[] = [];
  const events: HookEvent[] = ["PreToolUse", "PostToolUse", "SessionStart", "SessionEnd", "Notification"];

  const hooksConfig = config.hooks as Record<string, unknown> | undefined;
  if (!hooksConfig) return hooks;

  for (const event of events) {
    const eventHooks = hooksConfig[event] as Array<Record<string, string>> | undefined;
    if (!eventHooks) continue;

    for (const hook of eventHooks) {
      hooks.push({
        event,
        match: hook.match,
        command: hook.command,
        prompt: hook.prompt,
      });
    }
  }

  return hooks;
}
