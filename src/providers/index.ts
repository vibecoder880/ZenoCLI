import type { AiProvider } from "./base.js";
import { AnthropicProvider } from "./anthropic.js";
import { GoogleProvider } from "./google.js";
import { OpenAiProvider } from "./openai.js";

export function createProvider(slug: string): AiProvider {
  switch (slug.toLowerCase()) {
    case "openai":
      return new OpenAiProvider();
    case "anthropic":
      return new AnthropicProvider();
    case "google":
      return new GoogleProvider();
    default:
      throw new Error(`Unsupported provider "${slug}".`);
  }
}
