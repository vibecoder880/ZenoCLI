import { describe, expect, it } from "vitest";
import { ModelRegistry } from "./model-registry.js";
import { SmartRouter } from "./smart-router.js";
import { resolveModelRoute } from "./router.js";
import type { ZenoConfig } from "../storage/config.js";

const baseConfig = {
  default: { model: "openai/gpt-4.1-mini", provider: "openai", streaming: true },
  aliases: {},
  context: { maxTokens: 100000, ignore: [] },
} as unknown as ZenoConfig;

describe("SmartRouter (Super Kit pattern)", () => {
  it("picks the cheapest model on cost strategy", () => {
    const decision = new SmartRouter(new ModelRegistry()).route("cost");
    expect(decision.selected.id).toBe("openai/gpt-4o-mini");
    expect(decision.estimatedCostPerMillion).toBeLessThan(1);
  });

  it("picks the highest-quality model on quality strategy", () => {
    const decision = new SmartRouter(new ModelRegistry()).route("quality");
    expect(decision.selected.qualityScore).toBe(9.2);
    expect(decision.selected.provider).toBe("anthropic");
  });

  it("picks the fastest model on speed strategy", () => {
    const decision = new SmartRouter(new ModelRegistry()).route("speed");
    expect(decision.selected.latencyMs).toBeLessThanOrEqual(900);
  });

  it("returns a deterministic balanced decision", () => {
    const decision = new SmartRouter(new ModelRegistry()).route("balanced");
    expect(decision.selected.id).toBe("openai/gpt-4o-mini");
    expect(decision.reasoning).toContain("Best value");
  });

  it("defaults to balanced when no strategy given", () => {
    const decision = new SmartRouter(new ModelRegistry()).route();
    expect(decision.selected.id).toBe("openai/gpt-4o-mini");
  });
});

describe("resolveModelRoute auto (SmartRouter integration)", () => {
  it("routes model:auto through the registry", () => {
    const route = resolveModelRoute(baseConfig, "auto");
    expect(route.source).toBe("auto");
    expect(route.provider).toBe("openai");
    expect(route.model).toBe("gpt-4o-mini");
  });

  it("honors the configured routing strategy", () => {
    const config = {
      ...baseConfig,
      routing: { strategy: "quality" },
    } as unknown as ZenoConfig;

    const route = resolveModelRoute(config, "auto");
    expect(route.provider).toBe("anthropic");
    expect(route.model).toBe("claude-sonnet-4-0");
  });

  it("falls back to balanced when no routing config", () => {
    const route = resolveModelRoute(baseConfig, "auto");
    expect(route.source).toBe("auto");
    expect(route.model).toBe("gpt-4o-mini");
  });
});

describe("ModelRegistry", () => {
  it("registers all default models", () => {
    const registry = new ModelRegistry();
    expect(registry.getAll().length).toBeGreaterThanOrEqual(6);
    expect(registry.getByProvider("openai").length).toBe(3);
    expect(registry.getByTier("premium").length).toBe(3);
  });

  it("looks up a model by id", () => {
    const registry = new ModelRegistry();
    const model = registry.get("openai/gpt-4.1-mini");
    expect(model?.tier).toBe("standard");
    expect(model?.qualityScore).toBe(7.5);
  });
});
