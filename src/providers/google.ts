import type { AiProvider, ChatRequest, ModelInfo, ProviderStatus, StreamEvent } from "./base.js";
import { AuthProfileStore } from "../auth/auth-profiles.js";
import { resolveProviderSecret } from "./shared.js";

export class GoogleProvider implements AiProvider {
  readonly name = "Google";
  readonly slug = "google";
  readonly authMethods = ["oauth", "api_key"] as const;
  private readonly apiKey: string;

  public constructor(
    store = new AuthProfileStore(),
    apiKey = resolveProviderSecret(store, "google", "GOOGLE_API_KEY")
  ) {
    if (!apiKey) {
      throw new Error(
        "Google credentials were not found. Use GOOGLE_API_KEY or `neuro auth login google --method api-key`."
      );
    }

    this.apiKey = apiKey;
  }

  public async *chat(request: ChatRequest): AsyncIterable<StreamEvent> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: this.toSystemInstruction(request),
          contents: request.messages
            .filter((message) => message.role !== "system")
            .map((message) => ({
              role: message.role === "assistant" ? "model" : "user",
              parts: [{ text: message.content }]
            }))
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google API request failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };

    const text =
      payload.candidates
        ?.flatMap((candidate) => candidate.content?.parts ?? [])
        .map((part) => part.text ?? "")
        .join("") ?? "";

    if (text) {
      yield { type: "text", content: text };
    }

    yield {
      type: "done",
      usage: {
        inputTokens: payload.usageMetadata?.promptTokenCount,
        outputTokens: payload.usageMetadata?.candidatesTokenCount,
        totalTokens: payload.usageMetadata?.totalTokenCount
      }
    };
  }

  private toSystemInstruction(request: ChatRequest): { parts: Array<{ text: string }> } | undefined {
    const content = request.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n")
      .trim();

    if (!content) {
      return undefined;
    }

    return { parts: [{ text: content }] };
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
    return { ok: true, message: "Google credentials are configured." };
  }
}
