import type { AiProvider, ChatMessage, ToolCall, ToolSpec } from "../providers/base.js";

export interface CollectResult {
  text: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  /** Tool calls extracted from the response (if provider supports native tool_use). */
  toolCalls: ToolCall[];
}

/**
 * Collect all text from a provider stream.
 * Optionally calls onText for each chunk (for streaming UI).
 */
export async function collectProviderText(
  provider: AiProvider,
  model: string,
  messages: ChatMessage[],
  onText?: (chunk: string) => void,
  tools?: ToolSpec[]
): Promise<CollectResult> {
  let text = "";
  let totalTokens = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  const toolCalls: ToolCall[] = [];

  for await (const event of provider.chat({ model, messages, tools })) {
    if (event.type === "text") {
      text += event.content;
      onText?.(event.content);
    }

    if (event.type === "tool_call") {
      // Accumulate tool call arguments (may come in chunks)
      const existing = toolCalls.find((tc) => tc.id === event.id);
      if (existing) {
        // Append to existing partial arguments
        try {
          const current = existing.arguments as Record<string, unknown>;
          const merged = { ...current, ...JSON.parse(event.arguments) };
          existing.arguments = merged;
        } catch {
          // If we can't parse as JSON, keep the string concatenation
        }
      } else {
        // New tool call - arguments might be a partial JSON string
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(event.arguments);
        } catch {
          // Partial JSON, will be completed in subsequent events
          parsedArgs = { __raw__: event.arguments };
        }
        toolCalls.push({
          id: event.id,
          name: event.name,
          arguments: parsedArgs,
        });
      }
    }

    if (event.type === "done") {
      totalTokens = event.usage?.totalTokens ?? totalTokens;
      inputTokens = event.usage?.inputTokens ?? inputTokens;
      outputTokens = event.usage?.outputTokens ?? outputTokens;
    }

    if (event.type === "error") {
      throw new Error(event.message);
    }
  }

  return { text, totalTokens, inputTokens, outputTokens, toolCalls };
}
