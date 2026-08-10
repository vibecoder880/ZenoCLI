export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

// ---- Tool use types ----

export interface ToolCall {
  /** Tool call ID from the provider. */
  id: string;
  /** Tool name. */
  name: string;
  /** Tool arguments as parsed JSON object. */
  arguments: Record<string, unknown>;
}

export interface ToolResultMessage {
  role: "tool_result";
  /** The tool call ID this result belongs to. */
  toolCallId: string;
  /** The tool name. */
  toolName: string;
  /** The result content. */
  content: string;
  /** Whether the tool call errored. */
  isError?: boolean;
}

/** A message that can include both text and tool calls. */
export type RichMessage =
  | ChatMessage
  | ToolResultMessage
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] };

export interface ToolSpec {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      default?: unknown;
    }>;
    required?: string[];
  };
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  /** If provided, the provider should use native tool calling. */
  tools?: ToolSpec[];
  /** Optional signal to cancel an in-flight streaming request. */
  signal?: AbortSignal;
}

export type StreamEvent =
  | { type: "text"; content: string }
  | { type: "tool_call"; id: string; name: string; arguments: string }
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
