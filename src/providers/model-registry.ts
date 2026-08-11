/**
 * Model Registry — ported pattern from Super Kit's `ModelRegistry`.
 *
 * Central registry of models with real pricing, quality scores, latency, and
 * tier so the router can choose the right model per strategy. ZenoCLI's own
 * pricing table is the source of cost; quality/tier/latency extend it.
 */

export type ModelTier = "premium" | "standard" | "economy";

export interface AIModel {
  /** Fully-qualified id, e.g. "openai/gpt-4.1-mini". */
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

/** Default model metadata for the providers ZenoCLI ships with. */
const DEFAULT_MODELS: AIModel[] = [
  {
    id: "openai/gpt-4.1",
    provider: "openai",
    name: "GPT-4.1",
    tier: "premium",
    latencyMs: 3000,
    qualityScore: 9.0,
    pricing: { inputPerMillion: 2, outputPerMillion: 8 },
  },
  {
    id: "openai/gpt-4.1-mini",
    provider: "openai",
    name: "GPT-4.1 mini",
    tier: "standard",
    latencyMs: 1500,
    qualityScore: 7.5,
    pricing: { inputPerMillion: 0.4, outputPerMillion: 1.6 },
  },
  {
    id: "openai/gpt-4o-mini",
    provider: "openai",
    name: "GPT-4o mini",
    tier: "economy",
    latencyMs: 900,
    qualityScore: 6.5,
    pricing: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  },
  {
    id: "anthropic/claude-sonnet-4-0",
    provider: "anthropic",
    name: "Claude Sonnet 4",
    tier: "premium",
    latencyMs: 3500,
    qualityScore: 9.2,
    pricing: { inputPerMillion: 3, outputPerMillion: 15 },
  },
  {
    id: "google/gemini-2.5-pro",
    provider: "google",
    name: "Gemini 2.5 Pro",
    tier: "premium",
    latencyMs: 2800,
    qualityScore: 8.8,
    pricing: { inputPerMillion: 1.25, outputPerMillion: 10 },
  },
  {
    id: "google/gemini-2.5-flash",
    provider: "google",
    name: "Gemini 2.5 Flash",
    tier: "economy",
    latencyMs: 1000,
    qualityScore: 7.0,
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
