export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

const PRICING_TABLE: Record<string, ModelPricing> = {
  "openai/gpt-4.1": { inputPerMillion: 2, outputPerMillion: 8 },
  "openai/gpt-4.1-mini": { inputPerMillion: 0.4, outputPerMillion: 1.6 },
  "openai/gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  "anthropic/claude-sonnet-4-0": { inputPerMillion: 3, outputPerMillion: 15 },
  "google/gemini-2.5-pro": { inputPerMillion: 1.25, outputPerMillion: 10 },
  "google/gemini-2.5-flash": { inputPerMillion: 0.3, outputPerMillion: 2.5 }
};

export function estimateCostUsd(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): number | undefined {
  const pricing = PRICING_TABLE[`${provider}/${model}`];

  if (!pricing) {
    return undefined;
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
  return Number((inputCost + outputCost).toFixed(6));
}
