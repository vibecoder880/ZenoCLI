/**
 * Subagent Spawner — chạy isolated agents với context riêng.
 *
 * Subagent có fresh context window, chỉ nhận task prompt + tools.
 * Trả về summary, không trả toàn bộ conversation → giữ main context gọn.
 */

import type { AiProvider } from "../providers/base.js";
import { ContextManager } from "../core/context-manager.js";
import { collectProviderText } from "../core/stream.js";
import type { ToolExecutionContext } from "./tool-registry.js";
import { getToolDefinitionsForApi, executeTool } from "./tool-registry.js";
import os from "node:os";

// ---- Types ----

export interface SubagentOptions {
  /** Task description. */
  task: string;
  /** Available tools (default: read-only tools). */
  tools?: string[];
  /** Model override. */
  model?: string;
  /** Max turns (default: 10). */
  maxTurns?: number;
  /** Timeout in ms (default: 5min). */
  timeout?: number;
  /** Working directory. */
  cwd: string;
  /** Ignore patterns. */
  ignore?: string[];
  /** Provider to use. */
  provider: AiProvider;
  /** Project instructions. */
  projectInstructions?: string;
  /** Memory content. */
  memoryContent?: string;
}

export interface SubagentResult {
  /** Summary output (not full conversation). */
  output: string;
  /** Total tokens used. */
  tokensUsed: number;
  /** Files changed during execution. */
  filesChanged: string[];
  /** Whether subagent completed successfully. */
  success: boolean;
  /** Error message if failed. */
  error?: string;
  /** Number of turns taken. */
  turns: number;
  /** Tools that were used. */
  toolsUsed: string[];
}

// ---- Default Tool Sets ----

const READ_ONLY_TOOLS = [
  "read_file",
  "list_dir",
  "glob",
  "grep",
  "web_search",
  "web_fetch",
];

const RESEARCHER_TOOLS = [...READ_ONLY_TOOLS];

const CODER_TOOLS = [
  ...READ_ONLY_TOOLS,
  "write_file",
  "edit_file",
];

const TESTER_TOOLS = [
  ...CODER_TOOLS,
  "run_command",
];

// ---- Subagent Spawner ----

const MAX_CONCURRENT = Math.min(16, Math.max(1, (os.cpus()?.length ?? 2) - 2));
const MAX_TOTAL = 1000;
let activeCount = 0;
let totalSpawned = 0;

/** Spawn một subagent. */
export async function spawnSubagent(options: SubagentOptions): Promise<SubagentResult> {
  // Concurrency limits
  if (activeCount >= MAX_CONCURRENT) {
    return {
      output: "Subagent queue full — too many concurrent subagents.",
      tokensUsed: 0,
      filesChanged: [],
      success: false,
      error: "queue full",
      turns: 0,
      toolsUsed: [],
    };
  }

  if (totalSpawned >= MAX_TOTAL) {
    return {
      output: "Total subagent limit reached for this session.",
      tokensUsed: 0,
      filesChanged: [],
      success: false,
      error: "limit reached",
      turns: 0,
      toolsUsed: [],
    };
  }

  activeCount++;
  totalSpawned++;

  try {
    return await runSubagent(options);
  } finally {
    activeCount--;
  }
}

async function runSubagent(options: SubagentOptions): Promise<SubagentResult> {
  const {
    task,
    model,
    provider,
    cwd,
    ignore = [],
    maxTurns = 10,
    timeout = 5 * 60 * 1000, // 5 min
    projectInstructions,
    memoryContent,
  } = options;

  const tools = options.tools ?? READ_ONLY_TOOLS;
  const modelId = model ?? "anthropic/claude-sonnet-4-0";

  // Build tool context
  const toolContext: ToolExecutionContext = {
    cwd,
    ignore,
  };

  // Create isolated context manager
  const ctx = new ContextManager(50_000);
  const systemPrompt = buildSubagentPrompt(task, tools, projectInstructions, memoryContent);
  ctx.addSystem(systemPrompt);
  ctx.addUser(`Task: ${task}`, true);

  const startTime = Date.now();

  try {
    const result = await Promise.race<Promise<SubagentLoopResult> | Promise<never>>([
      executeSubagentLoop(provider, modelId, ctx, tools, toolContext, maxTurns),
      timeoutAfter<SubagentLoopResult>(timeout, "Subagent timeout"),
    ]);

    return {
      output: result.message,
      tokensUsed: result.totalTokens,
      filesChanged: [], // TODO: track file changes
      success: result.success,
      turns: result.turns,
      toolsUsed: result.toolsUsed,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      output: `Subagent error: ${message}`,
      tokensUsed: 0,
      filesChanged: [],
      success: false,
      error: message,
      turns: 0,
      toolsUsed: [],
    };
  } finally {
    const elapsed = Date.now() - startTime;
    // Log for debugging
    if (process.env.ZENOCLI_DEBUG) {
      console.error(`Subagent completed in ${elapsed}ms`);
    }
  }
}

async function executeSubagentLoop(
  provider: AiProvider,
  model: string,
  ctx: ContextManager,
  allowedTools: string[],
  toolContext: ToolExecutionContext,
  maxTurns: number,
): Promise<SubagentLoopResult> {
  let totalTokens = 0;
  const toolsUsed: string[] = [];
  const toolDefs = getToolDefinitionsForApi().filter((t) => allowedTools.includes(t.name));

  for (let turn = 0; turn < maxTurns; turn++) {
    if (ctx.needsCompaction()) {
      ctx.compact();
    }

    const messages = ctx.toMessages();
    const result = await collectProviderText(provider, model, messages, undefined, toolDefs);

    totalTokens += result.totalTokens;

    if (result.toolCalls.length > 0) {
      ctx.addAssistant(result.text || `[Used ${result.toolCalls.length} tool(s)]`);

      for (const toolCall of result.toolCalls) {
        // Verify tool is allowed
        if (!allowedTools.includes(toolCall.name)) {
          ctx.addToolResult(toolCall.name, `Tool "${toolCall.name}" is not available in this subagent.`);
          continue;
        }

        if (!toolsUsed.includes(toolCall.name)) {
          toolsUsed.push(toolCall.name);
        }

        const toolResult = await executeTool(toolCall.name, toolCall.arguments, toolContext);
        const output = toolResult.error ? `Error: ${toolResult.error}` : toolResult.output;
        ctx.addToolResult(toolCall.name, output);
      }
    } else if (result.text) {
      // Final response
      ctx.addAssistant(result.text);
      return {
        message: result.text,
        totalTokens,
        success: true,
        turns: turn + 1,
        toolsUsed,
      };
    } else {
      return {
        message: "Subagent produced no output.",
        totalTokens,
        success: false,
        turns: turn + 1,
        toolsUsed,
      };
    }
  }

  return {
    message: "Subagent reached max turns.",
    totalTokens,
    success: false,
    turns: maxTurns,
    toolsUsed,
  };
}

function buildSubagentPrompt(
  task: string,
  tools: string[],
  projectInstructions?: string,
  memoryContent?: string,
): string {
  const parts: string[] = [
    "You are a subagent in the ZenoCLI system.",
    "You have a specific, isolated task. Complete it efficiently and return a concise summary.",
    "",
    "## Available Tools",
    tools.join(", "),
    "",
    "## Guidelines",
    "- Focus on the assigned task only",
    "- Return a structured summary, not full conversation",
    "- Use minimal turns to complete the task",
  ];

  if (projectInstructions) {
    parts.push("", "## Project Instructions", projectInstructions);
  }

  if (memoryContent) {
    parts.push("", "## Memory", memoryContent);
  }

  return parts.join("\n");
}

function timeoutAfter<T>(ms: number, message: string): Promise<T> {
  return new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

interface SubagentLoopResult {
  message: string;
  totalTokens: number;
  success: boolean;
  turns: number;
  toolsUsed: string[];
}

// ---- Spawn by Agent Type ----

/** Spawn một subagent với preset tool set cho agent type. */
export async function spawnTypedSubagent(
  type: "researcher" | "coder" | "tester" | "reviewer",
  options: Omit<SubagentOptions, "tools">,
): Promise<SubagentResult> {
  const toolsByType: Record<string, string[]> = {
    researcher: RESEARCHER_TOOLS,
    coder: CODER_TOOLS,
    tester: TESTER_TOOLS,
    reviewer: [...READ_ONLY_TOOLS, "run_command"],
  };

  return spawnSubagent({
    ...options,
    tools: toolsByType[type] ?? READ_ONLY_TOOLS,
  });
}

// ---- Stats ----

/** Get current subagent stats. */
export function getSubagentStats(): { active: number; total: number; maxConcurrent: number; maxTotal: number } {
  return {
    active: activeCount,
    total: totalSpawned,
    maxConcurrent: MAX_CONCURRENT,
    maxTotal: MAX_TOTAL,
  };
}
