/**
 * Model Registry — ported pattern from Super Kit's `ModelRegistry`.
 *
 * Central registry of models with real pricing, quality scores, latency, and
 * tier so the router can choose the right model per strategy. ZenoCLI's own
 * pricing table is the source of cost; quality/tier/latency extend it.
 */

export type ModelTier = "premium" | "standard" | "economy";

export interface AIModel {
  /** Fully-qualified id, e.g. "openai/gpt-5.6-terra". */
  id: string;
  /** Provider slug, e.g. "openai". */
  provider: string;
  /** Short display name. */
  name: string;
  /** Cost/quality tier. */
  tier: ModelTier;
  /** Average response latency in ms. */
  latencyMs: number;
  /** Overall quality rating 1-10. */
  qualityScore: number;
  /** Cost per 1M tokens. */
  pricing: {
    inputPerMillion: number;
    outputPerMillion: number;
  };
}

/**
 * Default model metadata — current 2026 lineup per provider.
 *
 * Pricing is the official list price per 1M tokens (input/output) from each
 * provider's docs as of August 2026. Quality scores are heuristic ratings
 * 1-10 that feed the cheap/quality/speed/balanced routing strategies; they
 * are not official benchmarks.
 */
const DEFAULT_MODELS: AIModel[] = [
  // OpenAI — GPT-5.6 generation (premium/standard/economy)
  {
    id: "openai/gpt-5.6-sol",
    provider: "openai",
    name: "GPT-5.6 Sol",
    tier: "premium",
    latencyMs: 3000,
    qualityScore: 9.5,
    pricing: { inputPerMillion: 5, outputPerMillion: 30 },
  },
  {
    id: "openai/gpt-5.6-terra",
    provider: "openai",
    name: "GPT-5.6 Terra",
    tier: "standard",
    latencyMs: 1600,
    qualityScore: 8.5,
    pricing: { inputPerMillion: 2, outputPerMillion: 12 },
  },
  {
    id: "openai/gpt-5.6-luna",
    provider: "openai",
    name: "GPT-5.6 Luna",
    tier: "economy",
    latencyMs: 800,
    qualityScore: 6.8,
    pricing: { inputPerMillion: 0.2, outputPerMillion: 1.2 },
  },
  {
    id: "openai/gpt-5.5",
    provider: "openai",
    name: "GPT-5.5",
    tier: "premium",
    latencyMs: 2600,
    qualityScore: 9.2,
    pricing: { inputPerMillion: 5, outputPerMillion: 30 },
  },
  // Anthropic — Claude 5 family
  {
    id: "anthropic/claude-fable-5",
    provider: "anthropic",
    name: "Claude Fable 5",
    tier: "premium",
    latencyMs: 4200,
    qualityScore: 10.0,
    pricing: { inputPerMillion: 10, outputPerMillion: 50 },
  },
  {
    id: "anthropic/claude-opus-5",
    provider: "anthropic",
    name: "Claude Opus 5",
    tier: "premium",
    latencyMs: 3500,
    qualityScore: 9.8,
    pricing: { inputPerMillion: 5, outputPerMillion: 25 },
  },
  {
    id: "anthropic/claude-sonnet-5",
    provider: "anthropic",
    name: "Claude Sonnet 5",
    tier: "standard",
    latencyMs: 1500,
    qualityScore: 8.8,
    pricing: { inputPerMillion: 2, outputPerMillion: 10 },
  },
  {
    id: "anthropic/claude-haiku-4-5-20251001",
    provider: "anthropic",
    name: "Claude Haiku 4.5",
    tier: "economy",
    latencyMs: 700,
    qualityScore: 7.0,
    pricing: { inputPerMillion: 1, outputPerMillion: 5 },
  },
  // Google — Gemini 3.x
  {
    id: "google/gemini-3-pro",
    provider: "google",
    name: "Gemini 3 Pro",
    tier: "premium",
    latencyMs: 2400,
    qualityScore: 9.0,
    pricing: { inputPerMillion: 2, outputPerMillion: 12 },
  },
  {
    id: "google/gemini-3-flash",
    provider: "google",
    name: "Gemini 3 Flash",
    tier: "standard",
    latencyMs: 1100,
    qualityScore: 8.0,
    pricing: { inputPerMillion: 1.5, outputPerMillion: 9 },
  },
  {
    id: "google/gemini-3-flash-lite",
    provider: "google",
    name: "Gemini 3 Flash-Lite",
    tier: "economy",
    latencyMs: 600,
    qualityScore: 6.5,
    pricing: { inputPerMillion: 0.3, outputPerMillion: 2.5 },
  },
];

export class ModelRegistry {
  private readonly models = new Map<string, AIModel>();

  constructor() {
    for (const model of DEFAULT_MODELS) {
      this.register(model);
    }
  }

  /** Register or overwrite a model by id. */
  register(model: AIModel): void {
    this.models.set(model.id, model);
  }

  get(id: string): AIModel | undefined {
    return this.models.get(id);
  }

  getAll(): AIModel[] {
    return Array.from(this.models.values());
  }

  getByTier(tier: ModelTier): AIModel[] {
    return this.getAll().filter((model) => model.tier === tier);
  }

  getByProvider(provider: string): AIModel[] {
    return this.getAll().filter((model) => model.provider === provider);
  }
}
