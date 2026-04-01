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
        "Anthropic credentials were not found. Use ANTHROPIC_API_KEY or `neuro auth login anthropic --method api-key`."
      );
    }

    this.client = new Anthropic({ apiKey });
  }

  public async *chat(request: ChatRequest): AsyncIterable<StreamEvent> {
    const response = await this.client.messages.create({
      model: request.model,
      max_tokens: 4096,
      messages: request.messages
        .filter((message) => message.role !== "system")
        .map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content
        })),
      system: request.messages
        .filter((message) => message.role === "system")
        .map((message) => message.content)
        .join("\n\n")
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    if (text) {
      yield { type: "text", content: text };
    }

    yield {
      type: "done",
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      }
    };
  }

  public async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: "claude-sonnet-4-0",
        displayName: "Claude Sonnet 4",
        provider: this.slug
      }
    ];
  }

  public async healthCheck(): Promise<ProviderStatus> {
    return { ok: true, message: "Anthropic credentials are configured." };
  }
}
