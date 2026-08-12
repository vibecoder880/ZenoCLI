import { describe, expect, it } from "vitest";
import { ModelRegistry } from "./model-registry.js";
import { SmartRouter } from "./smart-router.js";
import { resolveMetadataModel, resolveModelRoute } from "./router.js";
import type { ZenoConfig } from "../storage/config.js";

const baseConfig = {
  default: { model: "openai/gpt-5.6-terra", provider: "openai", streaming: true },
  aliases: {},
  context: { maxTokens: 100000, ignore: [] },
} as unknown as ZenoConfig;

describe("SmartRouter (Super Kit pattern)", () => {
  it("picks the cheapest model on cost strategy", () => {
    const decision = new SmartRouter(new ModelRegistry()).route("cost");
    expect(decision.selected.id).toBe("openai/gpt-5.6-luna");
    expect(decision.estimatedCostPerMillion).toBe(1.4);
  });

  it("picks the highest-quality model on quality strategy", () => {
    const decision = new SmartRouter(new ModelRegistry()).route("quality");
    expect(decision.selected.qualityScore).toBe(10);
    expect(decision.selected.id).toBe("anthropic/claude-fable-5");
  });

  it("picks the fastest model on speed strategy", () => {
    const decision = new SmartRouter(new ModelRegistry()).route("speed");
    expect(decision.selected.latencyMs).toBeLessThanOrEqual(700);
  });

  it("returns a deterministic balanced decision", () => {
    const decision = new SmartRouter(new ModelRegistry()).route("balanced");
    expect(decision.reasoning).toContain("Best value");
    expect(decision.estimatedCostPerMillion).toBeGreaterThan(0);
  });

  it("defaults to balanced when no strategy given", () => {
    const decision = new SmartRouter(new ModelRegistry()).route();
    expect(decision.reasoning).toContain("Best value");
  });
});

describe("resolveModelRoute auto (SmartRouter integration)", () => {
  it("routes model:auto through the registry", () => {
    const route = resolveModelRoute(baseConfig, "auto");
    expect(route.source).toBe("auto");
    expect(route.provider).toBe("openai");
    expect(route.model).toBe("gpt-5.6-luna");
  });

  it("honors the configured routing strategy", () => {
    const config = {
      ...baseConfig,
      routing: { strategy: "quality" },
    } as unknown as ZenoConfig;

    const route = resolveModelRoute(config, "auto");
    expect(route.provider).toBe("anthropic");
    expect(route.model).toBe("claude-fable-5");
  });

  it("falls back to balanced when no routing config", () => {
    const route = resolveModelRoute(baseConfig, "auto");
    expect(route.source).toBe("auto");
    expect(route.model).toBe("gpt-5.6-luna");
  });
});

describe("resolveMetadataModel", () => {
  it("prefers the configured metadataModel", () => {
    const config = { ...baseConfig, metadataModel: "openai/gpt-5.6-luna" } as unknown as ZenoConfig;
    expect(resolveMetadataModel(config)).toBe("openai/gpt-5.6-luna");
  });

  it("falls back to the SmartRouter cost (economy) model", () => {
    const config = { ...baseConfig } as unknown as ZenoConfig;
    expect(resolveMetadataModel(config)).toBe("openai/gpt-5.6-luna");
  });
});

describe("ModelRegistry", () => {
  it("registers all default models", () => {
    const registry = new ModelRegistry();
    expect(registry.getAll().length).toBeGreaterThanOrEqual(8);
    expect(registry.getByProvider("openai").length).toBe(4);
    expect(registry.getByTier("premium").length).toBe(5);
  });

  it("looks up a model by id", () => {
    const registry = new ModelRegistry();
    const model = registry.get("anthropic/claude-sonnet-5");
    expect(model?.tier).toBe("standard");
    expect(model?.qualityScore).toBe(8.8);
  });
});
