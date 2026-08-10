import { DEFAULT_CONFIG, type ZenoConfig } from "../storage/config.js";

export interface ProviderRoute {
  provider: string;
  model: string;
  source: "explicit" | "alias" | "default";
}

function inferProviderFromModel(model: string): string {
  const normalized = model.toLowerCase();

  if (normalized.includes("/")) {
    return normalized.split("/", 1)[0];
  }

  if (normalized.startsWith("gpt") || normalized.startsWith("o1") || normalized.startsWith("o3")) {
    return "openai";
  }

  if (normalized.startsWith("claude")) {
    return "anthropic";
  }

  if (normalized.startsWith("gemini")) {
    return "google";
  }

  return DEFAULT_CONFIG.default.provider;
}

export function resolveModelRoute(
  config: ZenoConfig,
  model?: string,
  provider?: string
): ProviderRoute {
  if (model) {
    if (model === "auto") {
      const aliasTarget = config.aliases.smart ?? config.default.model;
      return resolveModelRoute(config, aliasTarget, provider);
    }

    const aliasTarget = config.aliases[model];

    if (aliasTarget) {
      const [aliasProvider, aliasModel] = aliasTarget.includes("/")
        ? aliasTarget.split("/", 2)
        : [inferProviderFromModel(aliasTarget), aliasTarget];

      return {
        provider: provider ?? aliasProvider,
        model: aliasModel,
        source: "alias"
      };
    }

    if (model.includes("/")) {
      const [explicitProvider, explicitModel] = model.split("/", 2);
      return {
        provider: provider ?? explicitProvider,
        model: explicitModel,
        source: "explicit"
      };
    }

    return {
      provider: provider ?? inferProviderFromModel(model),
      model,
      source: "explicit"
    };
  }

  const configuredDefault = config.default.model;
  const [defaultProvider, defaultModel] = configuredDefault.includes("/")
    ? configuredDefault.split("/", 2)
    : [config.default.provider, configuredDefault];

  return {
    provider: provider ?? defaultProvider,
    model: defaultModel,
    source: "default"
  };
}
