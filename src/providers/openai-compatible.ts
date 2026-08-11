import OpenAI from "openai";
import type { AiProvider, ChatRequest, ModelInfo, ProviderStatus, StreamEvent } from "./base.js";

/**
 * OpenAI-compatible provider (opencode-style).
 *
 * Talks to any endpoint speaking the OpenAI wire format via a custom baseURL,
 * so providers like OpenRouter, xAI, Azure, Groq, or local Ollama work from
 * config without a bespoke adapter. The API key is optional (local servers may
 * not need one); the model comes from the route, not a hardcoded list.
 */
export interface OpenAiCompatibleOptions {
  /** Display name. */
  name: string;
  /** Base URL, e.g. https://openrouter.ai/api/v1. */
  baseURL: string;
  /** API key (optional for local endpoints). */
  apiKey?: string;
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly name: string;
  readonly slug: string;
  readonly authMethods = ["api_key"] as const;

  private readonly client: OpenAI;

  public constructor(slug: string, options: OpenAiCompatibleOptions) {
    this.slug = slug;
    this.name = options.name;
    this.client = new OpenAI({
      baseURL: options.baseURL,
      // The SDK requires an apiKey option even for local servers; use a
      // placeholder when none is configured (Ollama, etc. ignore it).
      apiKey: options.apiKey ?? "not-needed",
    });
  }

  public async *chat(request: ChatRequest): AsyncIterable<StreamEvent> {
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    let totalTokens: number | undefined;

    const tools = request.tools?.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    const stream = await this.client.chat.completions.create(
      {
        model: request.model,
        messages: request.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        stream: true,
        ...(tools && tools.length > 0 ? { tools } : {}),
      },
      { signal: request.signal }
    );

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        yield { type: "text", content: delta.content };
      }

      if (delta?.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          yield {
            type: "tool_call",
            id: toolCall.id ?? "",
            name: toolCall.function?.name ?? "",
            arguments: toolCall.function?.arguments ?? "",
          };
        }
      }

      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens;
        outputTokens = chunk.usage.completion_tokens;
        totalTokens = chunk.usage.total_tokens;
      }
    }

    yield {
      type: "done",
      usage: { inputTokens, outputTokens, totalTokens },
    };
  }

  public async listModels(): Promise<ModelInfo[]> {
    // Compatible providers are model-agnostic; report the slug as the model.
    return [{ id: "*", displayName: this.name, provider: this.slug }];
  }

  public async healthCheck(): Promise<ProviderStatus> {
    return { ok: true, message: `${this.name} is configured (openai-compatible).` };
  }
}