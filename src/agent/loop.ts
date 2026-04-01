import type { ChatMessage } from "../providers/base.js";
import type { AiProvider } from "../providers/base.js";
import { collectProviderText } from "../core/stream.js";
import { describeWorkspace, executeTool, TOOL_DEFINITIONS, type ToolContext } from "./tools.js";

interface ToolCallResponse {
  type: "tool_call";
  thought: string;
  tool: string;
  args: Record<string, unknown>;
}

interface FinalResponse {
  type: "final";
  thought: string;
  message: string;
}

type AgentResponse = ToolCallResponse | FinalResponse;

export interface AgentLoopOptions {
  provider: AiProvider;
  model: string;
  task: string;
  toolContext: ToolContext;
  maxTurns?: number;
  projectInstructions?: string;
  onEvent?: (line: string) => void;
}

function buildSystemPrompt(workspaceSummary: string, projectInstructions?: string): string {
  const toolSpec = TOOL_DEFINITIONS.map(
    (tool) =>
      `${tool.name}: ${tool.description}. Args: ${Object.entries(tool.args)
        .map(([name, description]) => `${name}=${description}`)
        .join(", ")}`
  ).join("\n");

  return [
    "You are NeuroCLI, a careful coding agent.",
    "You can either call exactly one tool or return a final answer.",
    "Always respond with strict JSON and no markdown.",
    'Tool call format: {"type":"tool_call","thought":"short reason","tool":"read_file","args":{"path":"src/index.ts"}}',
    'Final format: {"type":"final","thought":"short reason","message":"user-facing answer"}',
    "Only use tools that are listed below.",
    toolSpec,
    "Current workspace summary:",
    workspaceSummary,
    projectInstructions ? `Project instructions:\n${projectInstructions}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
}

function parseAgentResponse(text: string): AgentResponse {
  const normalized = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");
  const parsed = JSON.parse(normalized) as AgentResponse;

  if (parsed.type !== "tool_call" && parsed.type !== "final") {
    throw new Error(`Unknown agent response type: ${(parsed as { type?: string }).type ?? "missing"}`);
  }

  return parsed;
}

export async function runAgentLoop(options: AgentLoopOptions): Promise<{ message: string; totalTokens: number }> {
  const maxTurns = options.maxTurns ?? 8;
  const workspaceSummary = await describeWorkspace(options.toolContext.cwd, options.toolContext.ignore);
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt(workspaceSummary, options.projectInstructions)
    },
    {
      role: "user",
      content: `Task: ${options.task}`
    }
  ];
  let totalTokens = 0;

  for (let turn = 0; turn < maxTurns; turn += 1) {
    const result = await collectProviderText(options.provider, options.model, messages);
    totalTokens += result.totalTokens;
    const response = parseAgentResponse(result.text);

    if (response.type === "final") {
      options.onEvent?.(`+ Final response prepared in ${turn + 1} turns`);
      return { message: response.message, totalTokens };
    }

    options.onEvent?.(`> ${response.thought}`);
    const toolResult = await executeTool(response.tool, response.args, options.toolContext);
    options.onEvent?.(`+ Tool ${response.tool} completed`);

    messages.push({
      role: "assistant",
      content: result.text
    });
    messages.push({
      role: "user",
      content: `Tool result for ${response.tool}:\n${toolResult}`
    });
  }

  throw new Error(`Agent reached the max turn limit of ${maxTurns}.`);
}
