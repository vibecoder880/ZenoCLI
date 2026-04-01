import type { AiProvider, ChatMessage } from "../providers/base.js";

export async function collectProviderText(
  provider: AiProvider,
  model: string,
  messages: ChatMessage[],
  onText?: (chunk: string) => void
): Promise<{ text: string; totalTokens: number; inputTokens: number; outputTokens: number }> {
  let text = "";
  let totalTokens = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  for await (const event of provider.chat({ model, messages })) {
    if (event.type === "text") {
      text += event.content;
      onText?.(event.content);
    }

    if (event.type === "done") {
      totalTokens = event.usage?.totalTokens ?? totalTokens;
      inputTokens = event.usage?.inputTokens ?? inputTokens;
      outputTokens = event.usage?.outputTokens ?? outputTokens;
    }

    if (event.type === "error") {
      throw new Error(event.message);
    }
  }

  return { text, totalTokens, inputTokens, outputTokens };
}
