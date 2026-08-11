import { afterEach, describe, expect, it, vi } from "vitest";
import { createProvider } from "./index.js";

vi.mock("../storage/config.js", () => ({
  loadConfig: () => ({
    default: { provider: "openai", model: "gpt-4.1-mini", streaming: true },
    context: { ignore: [] },
    providers: {
      openrouter: {
        name: "OpenRouter",
        type: "openai-compatible",
        baseURL: "https://openrouter.ai/api/v1",
        apiKeyEnv: "OPENROUTER_API_KEY",
      },
      ollama: {
        name: "Ollama",
        type: "openai-compatible",
        baseURL: "http://localhost:11434/v1",
      },
    },
  }),
}));

afterEach(() => {
  delete process.env.OPENROUTER_API_KEY;
});

describe("createProvider openai-compatible", () => {
  it("resolves an openai-compatible provider with a baseURL and apiKey env", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    const provider = createProvider("openrouter");

    expect(provider.name).toBe("OpenRouter");
    expect(provider.slug).toBe("openrouter");
    expect(provider.authMethods).toEqual(["api_key"]);
  });

  it("allows a local openai-compatible provider without an api key", () => {
    const provider = createProvider("ollama");

    expect(provider.name).toBe("Ollama");
    expect(provider.slug).toBe("ollama");
  });

  it("throws for an unknown provider not in config", () => {
    expect(() => createProvider("nonexistent")).toThrow(/Unsupported provider/);
  });
});