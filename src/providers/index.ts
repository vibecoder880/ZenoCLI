import type { AiProvider } from "./base.js";
import { AnthropicProvider } from "./anthropic.js";
import { GoogleProvider } from "./google.js";
import { OpenAiProvider } from "./openai.js";
import { AuthProfileStore } from "../auth/auth-profiles.js";
import { PROVIDER_CATALOG, type ProviderCatalogEntry } from "./catalog.js";
import { loadConfig } from "../storage/config.js";

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

/**
 * The provider catalog surfaced to `zeno models` / `zeno health`: the built-in
 * providers plus any additional providers declared in config's [providers] section.
 * Config-declared providers report their auth via the env key holder (api_key)
 * unless overridden.
 */
export function listProviderCatalog(): ProviderCatalogEntry[] {
  const config = loadConfig();
  const extra: ProviderCatalogEntry[] = Object.entries(config.providers ?? {}).map(
    ([slug, def]) => ({
      slug,
      name: def.name ?? slug,
      authMethods: def.authMethods ?? (def.envKey ? ["api_key"] : ["api_key"]),
    })
  );

  const builtin = new Set(PROVIDER_CATALOG.map((entry) => entry.slug));
  return [...PROVIDER_CATALOG, ...extra.filter((entry) => !builtin.has(entry.slug))];
}
