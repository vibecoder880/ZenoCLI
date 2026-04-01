import type { AiProvider } from "./base.js";
import { AnthropicProvider } from "./anthropic.js";
import { GoogleProvider } from "./google.js";
import { OpenAiProvider } from "./openai.js";
import { AuthProfileStore } from "../auth/auth-profiles.js";

export function createProvider(slug: string, store = new AuthProfileStore()): AiProvider {
  switch (slug.toLowerCase()) {
    case "openai":
      return new OpenAiProvider(store);
    case "anthropic":
      return new AnthropicProvider(store);
    case "google":
      return new GoogleProvider(store);
    default:
      throw new Error(`Unsupported provider "${slug}".`);
  }
}
