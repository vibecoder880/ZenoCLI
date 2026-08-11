import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "../storage/config.js";
import { selectUsableRoute } from "./router-fallback.js";

describe("selectUsableRoute", () => {
  it("routes auto to an available provider directly", () => {
    // With an OpenAI key, the SmartRouter picks the balanced (best-value)
    // openai model and it is usable as-is — no fallback needed.
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const selection = selectUsableRoute(DEFAULT_CONFIG, undefined, "auto");

    expect(selection.route.provider).toBe("openai");
    expect(selection.route.source).toBe("auto");
    expect(selection.reason).toBe("requested");

    vi.unstubAllEnvs();
  });

  it("throws when no provider has usable credentials", () => {
    // No env keys anywhere -> every route (auto and all fallbacks) is
    // unavailable, so selectUsableRoute must throw.
    expect(() => selectUsableRoute(DEFAULT_CONFIG, undefined, "auto")).toThrow();
  });
});
