/**
 * Intelligent Agentic Loop — context-aware, tool-using agent with:
 *   - Dynamic tool registry (glob, grep, web_search, etc.)
 *   - Context window management with auto-compaction
 *   - Session persistence (save/resume/fork)
 *   - Cross-session memory
 *   - Native provider tool_use (OpenAI, Anthropic, Google)
 *   - Mid-turn user corrections
 *   - Streaming events for TUI
 *   - Phase 2: Permission checks, safety classifier, checkpoints, hooks
 */

import type { AiProvider, ToolCall } from "../providers/base.js";
import { collectProviderText } from "../core/stream.js";
import { ContextManager } from "../core/context-manager.js";
import { type ToolExecutionContext, executeTool, getToolSpecsForPrompt, getToolDefinitionsForApi } from "./tool-registry.js";
import { registerAllTools } from "./tools/index.js";
import { getMergedInstructions } from "../core/zeno-md.js";
import { loadMemory } from "../core/memory.js";
import { SessionWriter } from "../core/session.js";
import { CheckpointManager } from "../safety/checkpoints.js";
import { classifySafety } from "../safety/classifier.js";
import { checkPermission, type PermissionConfig } from "../safety/permissions.js";
import { HookRunner } from "../plugins/hooks.js";

// ---- Types ----

export interface AgentEvent {
  type: "thought" | "tool_start" | "tool_result" | "final" | "compact" | "error" | "stream" | "permission" | "checkpoint";
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  tokens?: number;
}

export interface AgentLoopOptions {
  provider: AiProvider;
  model: string;
  task: string;
  toolContext: ToolExecutionContext;
  /** Max agent turns (default: 20). */
  maxTurns?: number;
  /** Existing context manager (for resumed sessions). */
  contextManager?: ContextManager;
  /** Session writer for persistence. */
  session?: SessionWriter;
  /** Callback for agent events (streaming to TUI). */
  onEvent?: (event: AgentEvent) => void;
  /** Callback for streaming text chunks. */
  onStream?: (chunk: string) => void;
  /** Mid-turn user messages queue. */
  pendingUserMessages?: string[];
  /** Whether to use native tool_use (default: true). */
  useNativeToolUse?: boolean;
  /** Permission config for tool execution. */
  permission?: PermissionConfig;
  /** Checkpoint manager (optional). */
  checkpoints?: CheckpointManager;
  /** Hook runner (optional). */
  hooks?: HookRunner;
  /** Permission prompt handler — returns true to allow, false to deny. */
  onPermissionPrompt?: (toolName: string, params: Record<string, unknown>, reason?: string) => Promise<boolean>;
  /** Abort signal to cancel the loop (checked per turn and before tool calls). */
  signal?: AbortSignal;
  /** Max retries for retryable provider errors (default: 0). */
  maxRetries?: number;
  /** Base retry delay in ms; doubles with backoff each retry (default: 1000). */
  retryBaseDelayMs?: number;
}

export interface AgentLoopResult {
  message: string;
  totalTokens: number;
  turns: number;
  toolsUsed: string[];
  /** True when the loop stopped because the abort signal fired. */
  aborted?: boolean;
}

// ---- System Prompt ----

function buildSystemPrompt(toolSpecs: string, projectInstructions?: string, memoryContent?: string): string {
  const parts = [
    "You are ZenoCLI, an intelligent coding agent.",
    "",
    "You operate in an agentic loop: gather context → take action → verify results.",
    "You can use multiple tools in sequence to accomplish complex tasks.",
    "When uncertain, ask the user for clarification using the ask_user tool.",
    "",
    "## Available Tools",
    toolSpecs,
    "",
    "## Guidelines",
    "- Read files before editing to understand context",
    "- Use glob/grep to find relevant files first",
    "- Verify changes by reading the file after editing",
    "- Use web_search to look up documentation when needed",
    "- Keep responses concise and actionable",
  ];

  if (projectInstructions) {
    parts.push("", "## Project Instructions", projectInstructions);
  }

  if (memoryContent) {
    parts.push("", "## Memory (learned preferences)", memoryContent);
  }

  return parts.join("\n");
}

// ---- Main Loop ----

/** Register built-in tools on first call. */
let toolsRegistered = false;

export async function runAgentLoop(options: AgentLoopOptions): Promise<AgentLoopResult> {
  // Ensure tools are registered
  if (!toolsRegistered) {
    registerAllTools();
    toolsRegistered = true;
  }

  const maxTurns = options.maxTurns ?? 20;

  // Load context sources
  const projectInstructions = getMergedInstructions(options.toolContext.cwd);
  const memoryContent = loadMemory(options.toolContext.cwd);
  const toolSpecs = getToolSpecsForPrompt();
  const systemPrompt = buildSystemPrompt(toolSpecs, projectInstructions, memoryContent);

  // Get tool definitions for native provider tool_use
  const toolDefs = getToolDefinitionsForApi();

  // Initialize or reuse context manager
  const maxContextTokens = 100_000; // Will be configurable
  const ctx = options.contextManager ?? new ContextManager(maxContextTokens);

  // Add system prompt
  ctx.addSystem(systemPrompt);

  // Add initial task
  ctx.addUser(`Task: ${options.task}`, true);
  options.session?.append({ type: "user", content: options.task, timestamp: new Date().toISOString() });

  let totalTokens = 0;
  const toolsUsed: string[] = [];

  const maxRetries = options.maxRetries ?? 0;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? 1000;

  for (let turn = 0; turn < maxTurns; turn++) {
    // Respect abort signal before starting each turn.
    if (isAborted(options.signal)) {
      const message = "Cancelled by user (abort signal).";
      options.onEvent?.({ type: "error", content: message });
      return { message, totalTokens, turns: turn, toolsUsed, aborted: true };
    }

    // Check for mid-turn user corrections
    if (options.pendingUserMessages && options.pendingUserMessages.length > 0) {
      const correction = options.pendingUserMessages.shift()!;
      ctx.addUser(correction);
      options.session?.append({ type: "user", content: correction, timestamp: new Date().toISOString() });
    }

    // Auto-compact if needed
    if (ctx.needsCompaction()) {
      const result = ctx.compact();
      if (result.compacted) {
        options.onEvent?.({
          type: "compact",
          content: `Context compacted: ${result.tokensFreed} tokens freed (${result.tokensBefore} → ${result.tokensAfter})`,
          tokens: result.tokensAfter,
        });
      }
    }

    // Get messages for API
    const messages = ctx.toMessages();

    try {
      // Call provider with native tool definitions, honouring the abort signal
      // and retrying retryable provider errors with bounded backoff.
      const result = await callWithRetry(
        () =>
          collectProviderText(
            options.provider,
            options.model,
            messages,
            options.onStream,
            toolDefs,
            options.signal,
          ),
        {
          signal: options.signal,
          maxRetries,
          baseDelayMs: retryBaseDelayMs,
          onRetry: (attempt, delayMs, message) =>
            options.onEvent?.({ type: "error", content: `Provider request failed (${message}); retry ${attempt}/${maxRetries} in ${delayMs}ms` }),
        },
      );

      totalTokens += result.totalTokens;

      // Handle response
      const hasToolCalls = result.toolCalls.length > 0;

      if (hasToolCalls) {
        // Native tool_use path
        ctx.addAssistant(result.text || `[Used ${result.toolCalls.length} tool(s)]`);
        options.session?.append({
          type: "assistant",
          content: result.text,
          timestamp: new Date().toISOString(),
        });

        for (const toolCall of result.toolCalls) {
          // Stop mid-batch if aborted after a tool call executed.
          if (isAborted(options.signal)) {
            const message = "Cancelled by user (abort signal).";
            options.onEvent?.({ type: "error", content: message });
            return { message, totalTokens, turns: turn + 1, toolsUsed, aborted: true };
          }
          await handleToolCall(toolCall, options, ctx, toolsUsed);
        }
      } else if (result.text) {
        // Check if it's a JSON-formatted response (fallback for non-native tool_use)
        const parsed = tryParseAgentJson(result.text);

        if (parsed && parsed.type === "tool_call") {
          ctx.addAssistant(result.text);
          options.session?.append({
            type: "assistant",
            content: result.text,
            timestamp: new Date().toISOString(),
          });

          // Convert to ToolCall format and handle
          const fakeCall: ToolCall = {
            id: `json_${turn}`,
            name: parsed.tool,
            arguments: parsed.args,
          };
          if (isAborted(options.signal)) {
            const message = "Cancelled by user (abort signal).";
            options.onEvent?.({ type: "error", content: message });
            return { message, totalTokens, turns: turn + 1, toolsUsed, aborted: true };
          }
          await handleToolCall(fakeCall, options, ctx, toolsUsed);
        } else if (parsed && parsed.type === "final") {
          // Final response
          ctx.addAssistant(parsed.message);
          options.session?.append({
            type: "assistant",
            content: parsed.message,
            timestamp: new Date().toISOString(),
          });

          options.onEvent?.({
            type: "final",
            content: parsed.message,
            tokens: totalTokens,
          });

          return { message: parsed.message, totalTokens, turns: turn + 1, toolsUsed };
        } else {
          // Plain text response — treat as final
          ctx.addAssistant(result.text);
          options.session?.append({
            type: "assistant",
            content: result.text,
            timestamp: new Date().toISOString(),
          });

          options.onEvent?.({
            type: "final",
            content: result.text,
            tokens: totalTokens,
          });

          return { message: result.text, totalTokens, turns: turn + 1, toolsUsed };
        }
      }
    } catch (err) {
      // An abort must surface as a clean stop, not as a "continue" turn.
      if (isAborted(options.signal) || (err instanceof Error && err.name === "AbortError")) {
        const message = "Cancelled by user (abort signal).";
        options.onEvent?.({ type: "error", content: message });
        return { message, totalTokens, turns: turn + 1, toolsUsed, aborted: true };
      }

      const message = err instanceof Error ? err.message : String(err);
      options.onEvent?.({ type: "error", content: message });

      // Try to continue after error
      ctx.addAssistant(`Error: ${message}`);
      ctx.addUser("Please try again with a different approach.");
    }

    // Reset compaction counter after each successful turn
    ctx.resetCompactionCounter();
  }

  // Max turns reached
  const finalMessage = `Agent reached the maximum of ${maxTurns} turns. Task may be incomplete.`;
  options.onEvent?.({ type: "error", content: finalMessage });
  return { message: finalMessage, totalTokens, turns: maxTurns, toolsUsed };
}

// ---- Helpers ----

async function handleToolCall(
  toolCall: ToolCall,
  options: AgentLoopOptions,
  ctx: ContextManager,
  toolsUsed: string[],
): Promise<void> {
  const { name, arguments: args } = toolCall;

  // ---- Permission check ----
  if (options.permission) {
    const prompt = checkPermission(name, args, options.permission);
    if (prompt) {
      let allowed = false;
      if (options.permission.mode === "auto") {
        // Use safety classifier in auto mode
        const verdict = classifySafety(name, args, options.toolContext.cwd);
        allowed = verdict.allowed;
        if (!allowed) {
          options.onEvent?.({
            type: "permission",
            content: `Safety classifier blocked: ${verdict.reason ?? "unknown reason"}`,
            toolName: name,
          });
        }
      } else if (options.onPermissionPrompt) {
        options.onEvent?.({
          type: "permission",
          content: `Permission required for ${name}: ${prompt.reason ?? ""}`,
          toolName: name,
        });
        allowed = await options.onPermissionPrompt(name, args, prompt.reason);
      }

      if (!allowed) {
        const errorResult = `Permission denied for "${name}". The user has not approved this action.`;
        options.onEvent?.({
          type: "tool_result",
          content: errorResult,
          toolName: name,
        });
        ctx.addToolResult(name, errorResult);
        options.session?.append({
          type: "tool_result",
          content: errorResult,
          tool: name,
          timestamp: new Date().toISOString(),
        });
        return;
      }
    }
  }

  // ---- Pre-tool hooks ----
  if (options.hooks && options.hooks.count > 0) {
    const hookResult = await options.hooks.fire("PreToolUse", {
      toolName: name,
      params: args,
      cwd: options.toolContext.cwd,
    });
    if (!hookResult.proceed) {
      const errorResult = `Blocked by PreToolUse hook: ${hookResult.error ?? "blocked"}`;
      options.onEvent?.({ type: "error", content: errorResult });
      ctx.addToolResult(name, errorResult);
      return;
    }
    if (hookResult.output) {
      ctx.addToolResult(name, `[Hook output]\n${hookResult.output}`);
    }
  }

  // ---- Checkpoint before file modification ----
  const isFileMod = (name === "write_file" || name === "edit_file") && options.checkpoints;
  if (isFileMod) {
    const targetPath = String(args.path ?? "");
    if (targetPath) {
      options.checkpoints!.snapshot(targetPath, name);
      options.onEvent?.({
        type: "checkpoint",
        content: `Snapshot saved: ${targetPath}`,
        toolName: name,
      });
    }
  }

  options.onEvent?.({
    type: "tool_start",
    content: `Using ${name}`,
    toolName: name,
    toolArgs: args,
  });

  options.session?.append({
    type: "tool_use",
    content: `Called ${name}`,
    tool: name,
    input: args,
    timestamp: new Date().toISOString(),
  });

  // Execute the tool (honours the loop abort signal when the tool supports it)
  const result = await executeTool(name, args, {
    ...options.toolContext,
    signal: options.signal,
  });

  if (!toolsUsed.includes(name)) {
    toolsUsed.push(name);
  }

  const resultContent = result.error
    ? `Tool error (${name}): ${result.error}`
    : result.output;

  options.onEvent?.({
    type: "tool_result",
    content: resultContent.slice(0, 500), // Truncate for event display
    toolName: name,
  });

  // Add tool result to context
  ctx.addToolResult(name, resultContent);

  options.session?.append({
    type: "tool_result",
    content: resultContent,
    tool: name,
    timestamp: new Date().toISOString(),
  });

  // ---- Post-tool hooks ----
  if (options.hooks && options.hooks.count > 0) {
    void options.hooks.fire("PostToolUse", {
      toolName: name,
      params: args,
      result: resultContent,
      cwd: options.toolContext.cwd,
    });
  }
}

/** Try to parse JSON-formatted agent response (fallback for non-native tool_use). */
function tryParseAgentJson(text: string): { type: "tool_call"; tool: string; args: Record<string, unknown>; thought: string } | { type: "final"; message: string; thought: string } | null {
  const normalized = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    const parsed = JSON.parse(normalized) as { type?: string; tool?: string; args?: Record<string, unknown>; message?: string; thought?: string };

    if (parsed.type === "tool_call" && parsed.tool) {
      return {
        type: "tool_call",
        tool: parsed.tool,
        args: parsed.args ?? {},
        thought: parsed.thought ?? "",
      };
    }

    if (parsed.type === "final" && parsed.message) {
      return {
        type: "final",
        message: parsed.message,
        thought: parsed.thought ?? "",
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ---- Abort + retry helpers ----

function isAborted(signal?: AbortSignal): boolean {
  return signal?.aborted === true;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Is this provider error worth a bounded retry? */
function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }
  // Aborts must never be retried.
  if (err.name === "AbortError") {
    return false;
  }
  const message = err.message.toLowerCase();
  return (
    /rate limit|429|too many|overloaded|500|502|503|504|interrupted|timeout|temporarily/.test(
      message
    ) ||
    err.name === "TimeoutError"
  );
}

/**
 * Run fn with bounded exponential backoff on retryable errors.
 * Non-retryable errors and aborts propagate immediately.
 */
async function callWithRetry<T>(
  fn: () => Promise<T>,
  opts: {
    signal?: AbortSignal;
    maxRetries: number;
    baseDelayMs: number;
    onRetry?: (attempt: number, delayMs: number, message: string) => void;
  }
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= opts.maxRetries || !isRetryableError(err)) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      const delayMs = opts.baseDelayMs * 2 ** attempt;
      attempt += 1;
      opts.onRetry?.(attempt, delayMs, message);
      await sleepMs(delayMs);
      if (opts.signal?.aborted) {
        throw new Error("Cancelled by user (abort signal).");
      }
    }
  }
}
