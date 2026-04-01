import type { AiProvider, ChatRequest, ModelInfo, ProviderStatus, StreamEvent } from "./base.js";

export class GoogleProvider implements AiProvider {
  readonly name = "Google";
  readonly slug = "google";
  readonly authMethods = ["oauth", "api_key"] as const;

  public async *chat(request: ChatRequest): AsyncIterable<StreamEvent> {
    void request;
    yield { type: "error", message: "Google chat is planned for Phase 2." };
  }

  public async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: "gemini-2.5-pro",
        displayName: "Gemini 2.5 Pro",
        provider: this.slug
      }
    ];
  }

  public async healthCheck(): Promise<ProviderStatus> {
    return {
      ok: false,
      message: "Google support is not active in Phase 1."
    };
  }
}
