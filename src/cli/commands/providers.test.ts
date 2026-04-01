import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rmSync } from "node:fs";
import { runHealthCommand, runModelsCommand } from "./providers.js";

const tempHome = "D:/VibeCoder/NeuroCli/.tmp-providers-home";

describe("provider commands", () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  beforeEach(() => {
    rmSync(tempHome, { recursive: true, force: true });
    vi.stubEnv("HOME", tempHome);
    vi.stubEnv("USERPROFILE", tempHome);
    log.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(tempHome, { recursive: true, force: true });
  });

  it("reports unavailable providers without credentials", async () => {
    await runHealthCommand();
    await runModelsCommand();

    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("openai: unavailable");
    expect(output).toContain("Configured aliases:");
  });
});
