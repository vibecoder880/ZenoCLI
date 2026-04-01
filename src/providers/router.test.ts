import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../storage/config.js";
import { resolveModelRoute } from "./router.js";

describe("resolveModelRoute", () => {
  it("resolves aliases from config", () => {
    expect(resolveModelRoute(DEFAULT_CONFIG, "fast")).toEqual({
      model: "gpt-4.1-mini",
      provider: "openai",
      source: "alias"
    });
  });

  it("infers provider from model name", () => {
    expect(resolveModelRoute(DEFAULT_CONFIG, "claude-sonnet-4-0")).toEqual({
      model: "claude-sonnet-4-0",
      provider: "anthropic",
      source: "explicit"
    });
  });
});
