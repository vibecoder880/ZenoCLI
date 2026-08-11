import Anthropic from "@anthropic-ai/sdk";
import type { AiProvider, ChatRequest, ModelInfo, ProviderStatus, StreamEvent } from "./base.js";
import { AuthProfileStore } from "../auth/auth-profiles.js";
import { resolveProviderSecret } from "./shared.js";

export class AnthropicProvider implements AiProvider {
  readonly name = "Anthropic";
  readonly slug = "anthropic";
  readonly authMethods = ["api_key"] as const;
  private readonly client: Anthropic;

  public constructor(
    store = new AuthProfileStore(),
    apiKey = resolveProviderSecret(store, "anthropic", "ANTHROPIC_API_KEY")
  ) {
    if (!apiKey) {
      throw new Error(
        "Anthropic credentials were not found. Use ANTHROPIC_API_KEY or `zeno auth login anthropic --method api-key`."
      );
    }

    this.client = new Anthropic({ apiKey });
  }

  public async *chat(request: ChatRequest): AsyncIterable<StreamEvent> {
    const systemContent = request.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");

    const apiMessages = request.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" as const : "user" as const,
        content: message.content,
      }));

    // Build Anthropic tools format if tools are provided
    const tools = request.tools?.map((tool): Anthropic.Messages.Tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters as Anthropic.Messages.Tool.InputSchema,
    }));

    // Use streaming for real-time output
    const stream = this.client.messages.stream(
      {
        model: request.model,
        max_tokens: 8192,
        system: systemContent || undefined,
        messages: apiMessages,
        ...(tools && tools.length > 0 ? { tools } : {}),
      },
      { signal: request.signal }
    );

    let inputTokens = 0;
    let outputTokens = 0;

    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          yield { type: "text", content: event.delta.text };
        }
        if (event.delta.type === "input_json_delta") {
          // Tool call arguments streaming in
          yield {
            type: "tool_call",
            id: "",  // Will be filled from content_block_start
            name: "",
            arguments: event.delta.partial_json,
          };
        }
      }

      if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          yield {
            type: "tool_call",
            id: event.content_block.id,
            name: event.content_block.name,
            arguments: "",
          };
        }
      }

      if (event.type === "message_start" && event.message.usage) {
        inputTokens = event.message.usage.input_tokens;
      }

      if (event.type === "message_delta" && event.usage) {
        outputTokens = event.usage.output_tokens;
      }
    }

    yield {
      type: "done",
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
    };
  }

  public async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: "claude-opus-4",
        displayName: "Claude Opus 4",
        provider: this.slug,
      },
      {
        id: "claude-sonnet-4-0",
        displayName: "Claude Sonnet 4",
        provider: this.slug,
      },
    ];
  }

  public async healthCheck(): Promise<ProviderStatus> {
    return { ok: true, message: "Anthropic credentials are configured." };
  }
}
