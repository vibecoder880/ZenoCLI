import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rmSync } from "node:fs";
import { AuthProfileStore } from "./auth-profiles.js";

const tempHome = "D:/VibeCoder/NeuroCli/.tmp-home";

describe("AuthProfileStore", () => {
  beforeEach(() => {
    rmSync(tempHome, { recursive: true, force: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(tempHome, { recursive: true, force: true });
  });

  it("saves and retrieves the active profile", () => {
    vi.stubEnv("HOME", tempHome);
    vi.stubEnv("USERPROFILE", tempHome);
    const store = new AuthProfileStore();

    const saved = store.saveProfile({
      type: "api_key",
      provider: "openai",
      key: "sk-test-123456789",
      label: "default"
    });

    expect(store.getActiveProfile("openai")?.id).toBe(saved.id);
  });
});
