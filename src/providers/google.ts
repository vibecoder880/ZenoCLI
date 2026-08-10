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
        "Google credentials were not found. Use GOOGLE_API_KEY or `zeno auth login google --method api-key`."
      );
    }

    this.apiKey = apiKey;
  }

  public async *chat(request: ChatRequest): AsyncIterable<StreamEvent> {
    // Build Google function declarations if tools are provided
    const tools = request.tools?.length
      ? [{
          functionDeclarations: request.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters as Record<string, unknown>,
          })),
        }]
      : undefined;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: this.toSystemInstruction(request),
          contents: request.messages
            .filter((message) => message.role !== "system")
            .map((message) => ({
              role: message.role === "assistant" ? "model" : "user",
              parts: [{ text: message.content }],
            })),
          ...(tools ? { tools } : {}),
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google API request failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<
            | { text?: string }
            | { functionCall?: { name: string; args: Record<string, unknown> } }
          >;
        };
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };

    // Process response parts
    const parts = payload.candidates?.[0]?.content?.parts ?? [];

    for (const part of parts) {
      if ("text" in part && part.text) {
        yield { type: "text", content: part.text };
      }

      if ("functionCall" in part && part.functionCall) {
        yield {
          type: "tool_call",
          id: `google_${part.functionCall.name}`,
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args),
        };
      }
    }

    yield {
      type: "done",
      usage: {
        inputTokens: payload.usageMetadata?.promptTokenCount,
        outputTokens: payload.usageMetadata?.candidatesTokenCount,
        totalTokens: payload.usageMetadata?.totalTokenCount,
      },
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
        provider: this.slug,
      },
      {
        id: "gemini-2.5-flash",
        displayName: "Gemini 2.5 Flash",
        provider: this.slug,
      },
    ];
  }

  public async healthCheck(): Promise<ProviderStatus> {
    return { ok: true, message: "Google credentials are configured." };
  }
}
