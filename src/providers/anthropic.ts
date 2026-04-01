import type { AiProvider, ChatRequest, ModelInfo, ProviderStatus, StreamEvent } from "./base.js";

export class AnthropicProvider implements AiProvider {
  readonly name = "Anthropic";
  readonly slug = "anthropic";
  readonly authMethods = ["api_key"] as const;

  public async *chat(request: ChatRequest): AsyncIterable<StreamEvent> {
    void request;
    yield { type: "error", message: "Anthropic chat is planned for Phase 2." };
  }

  public async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: "claude-4-sonnet",
        displayName: "Claude 4 Sonnet",
        provider: this.slug
      }
    ];
  }

  public async healthCheck(): Promise<ProviderStatus> {
    return {
      ok: false,
      message: "Anthropic support is not active in Phase 1."
    };
  }
}
