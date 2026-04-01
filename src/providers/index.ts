import type { AiProvider } from "./base.js";
import { AnthropicProvider } from "./anthropic.js";
import { GoogleProvider } from "./google.js";
import { OpenAiProvider } from "./openai.js";
import { AuthProfileStore } from "../auth/auth-profiles.js";
import { PROVIDER_CATALOG } from "./catalog.js";

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

export function tryCreateProvider(
  slug: string,
  store = new AuthProfileStore()
): { ok: true; provider: AiProvider } | { ok: false; error: Error } {
  try {
    return { ok: true, provider: createProvider(slug, store) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(`Unknown provider error for ${slug}`)
    };
  }
}

export function listProviderCatalog() {
  return PROVIDER_CATALOG;
}
