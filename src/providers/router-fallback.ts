import { AuthProfileStore } from "../auth/auth-profiles.js";
import { tryCreateProvider } from "./index.js";
import { resolveModelRoute, type ProviderRoute } from "./router.js";
import type { NeuroConfig } from "../storage/config.js";

export interface RoutedProviderSelection {
  route: ProviderRoute;
  reason: "requested" | "fallback";
  warning?: string;
}

function getFallbackModels(config: NeuroConfig): string[] {
  return [
    config.aliases.smart,
    config.aliases.fast,
    config.aliases.cheap,
    config.default.model
  ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
}

export function selectUsableRoute(
  config: NeuroConfig,
  store = new AuthProfileStore(),
  model?: string,
  provider?: string
): RoutedProviderSelection {
  const requested = resolveModelRoute(config, model, provider);
  const requestedProvider = tryCreateProvider(requested.provider, store);

  if (requestedProvider.ok) {
    return {
      route: requested,
      reason: "requested"
    };
  }

  const requestedExplicitly = Boolean(provider) || (Boolean(model) && model !== "auto");

  if (requestedExplicitly) {
    throw requestedProvider.error;
  }

  for (const fallback of getFallbackModels(config)) {
    const route = resolveModelRoute(config, fallback, undefined);
    const created = tryCreateProvider(route.provider, store);

    if (created.ok) {
      return {
        route,
        reason: "fallback",
        warning: `Requested route ${requested.provider}/${requested.model} was unavailable. Using ${route.provider}/${route.model}.`
      };
    }
  }

  throw requestedProvider.error;
}
