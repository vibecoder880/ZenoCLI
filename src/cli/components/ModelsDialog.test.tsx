import { describe, expect, it, vi } from "vitest";
import { setActiveModel } from "./ModelsDialog.js";

vi.mock("../../storage/config.js", () => ({
  loadConfig: () => ({
    default: { model: "old", provider: "openai", streaming: true },
    context: { ignore: [] },
  }),
  saveConfig: vi.fn(),
  updateConfig: (mutator: (config: { default: { model: string; provider: string } }) => { default: { model: string; provider: string } }) =>
    mutator({
      default: { model: "old", provider: "openai" },
    }),
}));

describe("setActiveModel", () => {
  it("updates default.model and infers the provider from the model id", () => {
    const next = setActiveModel("anthropic/claude-opus-4");
    expect(next.default.model).toBe("anthropic/claude-opus-4");
    expect(next.default.provider).toBe("anthropic");
  });

  it("keeps the provider for a bare model id", () => {
    vi.stubEnv("SKIP", "");
    const next = setActiveModel("some-local-model");
    expect(next.default.model).toBe("some-local-model");
    expect(next.default.provider).toBe("openai");
  });
});