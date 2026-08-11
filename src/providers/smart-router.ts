/**
 * Smart Router — ported pattern from Super Kit's `SmartRouter`.
 *
 * Chooses a model from the registry based on a routing strategy: minimize
 * cost, maximize quality, minimize latency, or balance all three. This powers
 * `model: auto` so ZenoCLI can pick the best available model per task without
 * hardcoding one.
 */

import type { AIModel } from "./model-registry.js";
import { ModelRegistry } from "./model-registry.js";

export type RoutingStrategy = "cost" | "quality" | "speed" | "balanced";

export interface RoutingDecision {
  /** The selected model. */
  selected: AIModel;
  /** Human-readable explanation of the choice. */
  reasoning: string;
  /** Estimated cost per 1M input+output tokens in USD. */
  estimatedCostPerMillion: number;
}

/** Rough cost estimate for 1M in + 1M out tokens. */
function estimateCostPerMillion(model: AIModel): number {
  return model.pricing.inputPerMillion + model.pricing.outputPerMillion;
}

export class SmartRouter {
  constructor(private readonly registry: ModelRegistry) {}

  /** Pick the best model for the given strategy. */
  route(strategy: RoutingStrategy = "balanced"): RoutingDecision {
    const models = this.registry.getAll();
    if (models.length === 0) {
      throw new Error("Model registry is empty — cannot route.");
    }

    let selected: AIModel;
    let reasoning: string;

    switch (strategy) {
      case "cost": {
        selected = [...models].sort(
          (a, b) => estimateCostPerMillion(a) - estimateCostPerMillion(b)
        )[0];
        reasoning = `Cheapest available model (${selected.id}, $${estimateCostPerMillion(selected).toFixed(2)}/1M tokens).`;
        break;
      }
      case "quality": {
        selected = [...models].sort((a, b) => b.qualityScore - a.qualityScore)[0];
        reasoning = `Highest-quality model (${selected.id}, quality ${selected.qualityScore}/10).`;
        break;
      }
      case "speed": {
        selected = [...models].sort((a, b) => a.latencyMs - b.latencyMs)[0];
        reasoning = `Fastest model (${selected.id}, ~${selected.latencyMs}ms latency).`;
        break;
      }
      case "balanced":
      default: {
        // Balance quality and cost: score = quality / (cost + 1) to favor value.
        selected = [...models].sort((a, b) => {
          const scoreA = a.qualityScore / (estimateCostPerMillion(a) + 1);
          const scoreB = b.qualityScore / (estimateCostPerMillion(b) + 1);
          return scoreB - scoreA;
        })[0];
        reasoning = `Best value (${selected.id}): quality ${selected.qualityScore}/10 at $${estimateCostPerMillion(selected).toFixed(2)}/1M.`;
        break;
      }
    }

    return {
      selected,
      reasoning,
      estimatedCostPerMillion: estimateCostPerMillion(selected),
    };
  }
}
