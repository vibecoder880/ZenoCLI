export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
}

export type StreamEvent =
  | { type: "text"; content: string }
  | { type: "done"; usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } }
  | { type: "error"; message: string };

export interface ModelInfo {
  id: string;
  displayName: string;
  provider: string;
}

export interface ProviderStatus {
  ok: boolean;
  message: string;
}

export interface AiProvider {
  readonly name: string;
  readonly slug: string;
  readonly authMethods: readonly ("oauth" | "api_key" | "local")[];

  chat(request: ChatRequest): AsyncIterable<StreamEvent>;
  listModels(): Promise<ModelInfo[]>;
  healthCheck(): Promise<ProviderStatus>;
}
