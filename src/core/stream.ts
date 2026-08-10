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
 * If a signal is provided, an already-aborted or mid-stream abort stops the
 * collection and rethrows the abort reason (defaulting to an AbortError).
 * Callers that pass a signal should be prepared to catch it.
 */
export async function collectProviderText(
  provider: AiProvider,
  model: string,
  messages: ChatMessage[],
  onText?: (chunk: string) => void,
  tools?: ToolSpec[],
  signal?: AbortSignal
): Promise<CollectResult> {
  if (signal?.aborted) {
    throw abortError(signal);
  }

  // Watch the signal so a mid-stream abort races the next chunk and unblocks
  // the caller even when a provider adapter does not honour the signal itself.
  let onAbort: ((reason: Error) => void) | undefined;
  const abortPromise = signal
    ? new Promise<never>((_, reject) => {
        onAbort = reject;
        signal.addEventListener("abort", () => reject(abortError(signal)), { once: true });
      })
    : undefined;

  const iterator = provider.chat({ model, messages, tools, signal })[Symbol.asyncIterator]();

  let text = "";
  let totalTokens = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  const toolCalls: ToolCall[] = [];

  try {
    for (;;) {
      const next = abortPromise ? Promise.race([iterator.next(), abortPromise]) : iterator.next();
      const { done, value } = await next;
      if (done) {
        break;
      }
      const event = value;

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
  } finally {
    if (onAbort) {
      signal?.removeEventListener("abort", onAbort as EventListener);
    }
  }

  return { text, totalTokens, inputTokens, outputTokens, toolCalls };
}

function abortError(signal: AbortSignal): Error {
  const cause = signal.reason;
  if (cause instanceof Error) {
    return cause;
  }
  const error = new Error(typeof cause === "string" ? cause : "The operation was aborted.");
  error.name = "AbortError";
  return error;
}
