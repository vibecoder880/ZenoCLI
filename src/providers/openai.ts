import OpenAI from "openai";
import type { AiProvider, ChatRequest, ModelInfo, ProviderStatus, StreamEvent } from "./base.js";
import { AuthProfileStore } from "../auth/auth-profiles.js";
import { resolveProviderSecret } from "./shared.js";

export class OpenAiProvider implements AiProvider {
  readonly name = "OpenAI";
  readonly slug = "openai";
  readonly authMethods = ["api_key"] as const;

  private readonly client: OpenAI;

  public constructor(
    store = new AuthProfileStore(),
    apiKey = resolveProviderSecret(store, "openai", "OPENAI_API_KEY")
  ) {
    if (!apiKey) {
      throw new Error(
        "OpenAI credentials were not found. Use OPENAI_API_KEY or `neuro auth login openai --method api-key`."
      );
    }

    this.client = new OpenAI({ apiKey });
  }

  public async *chat(request: ChatRequest): AsyncIterable<StreamEvent> {
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    let totalTokens: number | undefined;

    const stream = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages,
      stream: true
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;

      if (delta) {
        yield { type: "text", content: delta };
      }

      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens;
        outputTokens = chunk.usage.completion_tokens;
        totalTokens = chunk.usage.total_tokens;
      }
    }

    yield {
      type: "done",
      usage: {
        inputTokens,
        outputTokens,
        totalTokens
      }
    };
  }

  public async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: "gpt-4.1-mini",
        displayName: "GPT-4.1 mini",
        provider: this.slug
      },
      {
        id: "gpt-4.1",
        displayName: "GPT-4.1",
        provider: this.slug
      },
      {
        id: "gpt-4o-mini",
        displayName: "GPT-4o mini",
        provider: this.slug
      }
    ];
  }

  public async healthCheck(): Promise<ProviderStatus> {
    try {
      await this.client.models.list();

      return {
        ok: true,
        message: "OpenAI credentials are valid."
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown OpenAI error"
      };
    }
  }
}
