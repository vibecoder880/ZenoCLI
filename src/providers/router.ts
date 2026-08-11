import { DEFAULT_CONFIG, type ZenoConfig } from "../storage/config.js";
import { BudgetTracker } from "../core/budget-tracker.js";
import { ModelRegistry } from "./model-registry.js";
import { SmartRouter } from "./smart-router.js";

export interface ProviderRoute {
  provider: string;
  model: string;
  source: "explicit" | "alias" | "default" | "auto";
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
      // Route through the Super Kit-inspired SmartRouter, preferring the
      // configured strategy (config.routing?.strategy) or balanced by default.
      // Under budget pressure the tracker downgrades to the cost strategy so
      // spend stays within the configured daily/monthly limits.
      const status = new BudgetTracker(config.budget ?? {}).getStatus();
      const strategy =
        status.shouldDowngrade ? "cost" : (config.routing?.strategy ?? "balanced");
      const decision = new SmartRouter(new ModelRegistry()).route(strategy);
      const [routeProvider, routeModel] = decision.selected.id.includes("/")
        ? decision.selected.id.split("/", 2)
        : [decision.selected.provider, decision.selected.id];

      return {
        provider: provider ?? routeProvider,
        model: routeModel,
        source: "auto",
      };
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
