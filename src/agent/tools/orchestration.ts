/**
 * Orchestration tools: ask_user, spawn_subagent, plan_mode.
 */

import type { ToolDefinition, ToolExecutionContext, ToolResult } from "../tool-registry.js";

const askUserTool: ToolDefinition = {
  name: "ask_user",
  description: "Ask the user a question and wait for their response. Use when you need clarification or a decision.",
  category: "orchestration",
  safety: "safe",
  parameters: {
    type: "object",
    properties: {
      question: { type: "string", description: "The question to ask the user." },
      options: {
        type: "string",
        description: "Comma-separated list of options (optional).",
      },
    },
    required: ["question"],
  },
  async execute(params, context: ToolExecutionContext): Promise<ToolResult> {
    const question = String(params.question ?? "");
    const optionsStr = String(params.options ?? "");

    if (!context.askUser) {
      return { output: "", error: "ask_user tool is not available in this context (no TUI)." };

    }

    const options = optionsStr
      ? optionsStr.split(",").map((o) => o.trim()).filter(Boolean)
      : undefined;

    try {
      const answer = await context.askUser(question, options);
      return { output: answer };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { output: "", error: `User interaction failed: ${message}` };
    }
  },
};

/**
 * LSP Tool — expose diagnostics to the agent.
 */
const lspDiagnosticsTool: ToolDefinition = {
  name: "lsp_diagnostics",
  description: "Get type errors and warnings for a file using the language server (auto-detected from project).",
  category: "search",
  safety: "safe",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to check." },
    },
    required: ["path"],
  },
  async execute(): Promise<ToolResult> {
    // LSP not available in pure tool context — requires LSP manager setup
    return { output: "", error: "LSP not available in this context. Run zeno from a TypeScript project to enable LSP tools." };
  },
};
const spawnSubagentTool: ToolDefinition = {
  name: "spawn_subagent",
  description: "Spawn an isolated subagent to perform a task. Returns a summary. Supports typed agents (researcher, coder, tester, reviewer).",
  category: "orchestration",
  safety: "moderate",
  parameters: {
    type: "object",
    properties: {
      task: { type: "string", description: "The task for the subagent." },
      type: { type: "string", description: "Agent type: 'researcher', 'coder', 'tester', 'reviewer' (default: researcher).", enum: ["researcher", "coder", "tester", "reviewer"] },
      tools: { type: "string", description: "Comma-separated list of tools (overrides type defaults)." },
      timeout: { type: "number", description: "Timeout in milliseconds (default: 5min)." },
    },
    required: ["task"],
  },
  async execute(): Promise<ToolResult> {
    // Subagent spawning requires a provider — not available in tool context alone
    return {
      output: "",
      error: "spawn_subagent must be called by the orchestrator (not available from within a tool). Use the team coordination CLI instead.",
    };
  },
};

// ---- Export all definitions ----

export const orchestrationToolDefinitions: ToolDefinition[] = [
  askUserTool,
  spawnSubagentTool,
  lspDiagnosticsTool,
];
