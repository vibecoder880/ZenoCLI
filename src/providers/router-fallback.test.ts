import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "../storage/config.js";
import { selectUsableRoute } from "./router-fallback.js";

describe("selectUsableRoute", () => {
  it("falls back from unavailable auto route", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const selection = selectUsableRoute(DEFAULT_CONFIG, undefined, "auto");

    expect(selection.route.provider).toBe("openai");
    expect(selection.reason).toBe("fallback");

    vi.unstubAllEnvs();
  });
});
