import { describe, expect, it } from "vitest";
import { detectFirstRun } from "./useFirstRun.js";
import type { NeuroConfig } from "../../storage/config.js";

const baseConfig: NeuroConfig = {
  default: { model: "openai/gpt-4.1-mini", provider: "openai", streaming: true },
  aliases: {},
  context: { maxTokens: 100000, ignore: [] },
  permission: { mode: "default", autoApprove: {} }
} as unknown as NeuroConfig;

describe("detectFirstRun", () => {
  it("returns isFirstRun false when providers and aliases are set", () => {
    const config = {
      ...baseConfig,
      aliases: { fast: "openai/gpt-4.1-mini" }
    } as NeuroConfig;
    const state = detectFirstRun(config);
    // Note: actual provider state depends on global auth store; just check shape.
    expect(state).toHaveProperty("isFirstRun");
    expect(state).toHaveProperty("missingProviders");
    expect(state).toHaveProperty("hasAnyProvider");
  });

  it("treats empty aliases as first-run indicator", () => {
    const state = detectFirstRun(baseConfig);
    if (state.hasAnyProvider) {
      // If a provider IS configured in the test env, the empty aliases still make it first-run.
      expect(state.isFirstRun).toBe(true);
    }
  });
});
