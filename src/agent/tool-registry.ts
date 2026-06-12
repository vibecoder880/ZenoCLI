/**
 * Dynamic tool registry with lazy-loading schemas, safety levels, and categories.
 * Replaces the hardcoded TOOL_DEFINITIONS array in tools.ts.
 */

/** JSON Schema type for tool parameters. */
export type JsonSchema = {
  type: "object";
  properties: Record<string, {
    type: string;
    description: string;
    enum?: string[];
    default?: unknown;
  }>;
  required?: string[];
};

export type ToolCategory = "fs" | "search" | "web" | "exec" | "orchestration";
export type SafetyLevel = "safe" | "moderate" | "dangerous";

export interface ToolResult {
  output: string;
  error?: string;
}

export interface ToolDefinition {
  /** Unique tool name, e.g. "read_file" or "mcp__server__tool". */
  name: string;
  /** Short description for the model. */
  description: string;
  /** JSON Schema for parameters (lazy-loaded via getSchema). */
  parameters: JsonSchema;
  /** Safety classification for permission system. */
  safety: SafetyLevel;
  /** Tool category for grouping. */
  category: ToolCategory;
  /** Execute the tool with given parameters. */
  execute(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult>;
}

/** Shared execution context passed to every tool. */
export interface ToolExecutionContext {
  /** Current working directory. */
  cwd: string;
  /** Directory / file patterns to ignore. */
  ignore: string[];
  /** Called to ask the user a question (for ask_user tool). */
  askUser?: (question: string, options?: string[]) => Promise<string>;
  /** Optional abort signal. */
  signal?: AbortSignal;
}

// ---- Registry ----

const registry = new Map<string, ToolDefinition>();

/** Register a tool definition. Overwrites if name already exists. */
export function registerTool(tool: ToolDefinition): void {
  registry.set(tool.name, tool);
}

/** Register multiple tools at once. */
export function registerTools(tools: ToolDefinition[]): void {
  for (const tool of tools) {
    registerTool(tool);
  }
}

/** Get a single tool by name. */
export function getTool(name: string): ToolDefinition | undefined {
  return registry.get(name);
}

/** Get all registered tools. */
export function getAllTools(): ToolDefinition[] {
  return Array.from(registry.values());
}

/** Get tool definitions filtered by category. */
export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return getAllTools().filter((t) => t.category === category);
}

/** Get compact tool specs for system prompt (name + description only). */
export function getToolSpecsForPrompt(): string {
  return getAllTools()
    .map((t) => {
      const params = Object.entries(t.parameters.properties)
        .map(([name, schema]) => `${name}: ${schema.description}`)
        .join(", ");
      return `${t.name}: ${t.description}. Params: ${params}`;
    })
    .join("\n");
}

/** Get all tool definitions in provider-native format for API calls. */
export function getToolDefinitionsForApi(): Array<{
  name: string;
  description: string;
  parameters: JsonSchema;
}> {
  return getAllTools().map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

/** Execute a tool by name with given params and context. */
export async function executeTool(
  name: string,
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  const tool = registry.get(name);
  if (!tool) {
    return { output: "", error: `Unknown tool "${name}".` };
  }
  try {
    return await tool.execute(params, context);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { output: "", error: message };
  }
}

/** Clear all registered tools (useful for tests). */
export function clearRegistry(): void {
  registry.clear();
}
