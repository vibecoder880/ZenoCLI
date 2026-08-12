export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

const PRICING_TABLE: Record<string, ModelPricing> = {
  // OpenAI — GPT-5.6 / GPT-5.5
  "openai/gpt-5.6-sol": { inputPerMillion: 5, outputPerMillion: 30 },
  "openai/gpt-5.6-terra": { inputPerMillion: 2, outputPerMillion: 12 },
  "openai/gpt-5.6-luna": { inputPerMillion: 0.2, outputPerMillion: 1.2 },
  "openai/gpt-5.5": { inputPerMillion: 5, outputPerMillion: 30 },
  // Anthropic — Claude 5 family
  "anthropic/claude-fable-5": { inputPerMillion: 10, outputPerMillion: 50 },
  "anthropic/claude-opus-5": { inputPerMillion: 5, outputPerMillion: 25 },
  "anthropic/claude-sonnet-5": { inputPerMillion: 2, outputPerMillion: 10 },
  "anthropic/claude-haiku-4-5-20251001": { inputPerMillion: 1, outputPerMillion: 5 },
  // Google — Gemini 3.x
  "google/gemini-3-pro": { inputPerMillion: 2, outputPerMillion: 12 },
  "google/gemini-3-flash": { inputPerMillion: 1.5, outputPerMillion: 9 },
  "google/gemini-3-flash-lite": { inputPerMillion: 0.3, outputPerMillion: 2.5 }
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
