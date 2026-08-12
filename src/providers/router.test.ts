import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../storage/config.js";
import { resolveModelRoute } from "./router.js";

describe("resolveModelRoute", () => {
  it("resolves aliases from config", () => {
    expect(resolveModelRoute(DEFAULT_CONFIG, "fast")).toEqual({
      model: "gpt-5.6-luna",
      provider: "openai",
      source: "alias"
    });
  });

  it("infers provider from model name", () => {
    expect(resolveModelRoute(DEFAULT_CONFIG, "claude-sonnet-5")).toEqual({
      model: "claude-sonnet-5",
      provider: "anthropic",
      source: "explicit"
    });
  });

  it("routes auto through the SmartRouter (balanced default)", () => {
    // With DEFAULT_CONFIG (balanced strategy), auto picks the best-value model.
    expect(resolveModelRoute(DEFAULT_CONFIG, "auto")).toEqual({
      model: "gpt-5.6-luna",
      provider: "openai",
      source: "auto"
    });
  });
});
