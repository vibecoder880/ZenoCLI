import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { appendHistoryEntry, listHistoryEntries, summarizeTokenUsage } from "./history.js";

const tempHome = path.join(os.tmpdir(), `.zeno-test-history-${Date.now()}`);

describe("history storage", () => {
  beforeEach(() => {
    rmSync(tempHome, { recursive: true, force: true });
    vi.stubEnv("HOME", tempHome);
    vi.stubEnv("USERPROFILE", tempHome);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(tempHome, { recursive: true, force: true });
  });

  it("stores entries and summarizes tokens", () => {
    appendHistoryEntry({
      cwd: tempHome,
      provider: "openai",
      model: "gpt-4.1-mini",
      prompt: "hello",
      response: "world",
      totalTokens: 42,
      estimatedCostUsd: 0.001
    });

    expect(listHistoryEntries(1)).toHaveLength(1);
    expect(summarizeTokenUsage()).toEqual({
      totalEntries: 1,
      totalTokens: 42,
      totalEstimatedCostUsd: 0.001
    });
  });
});
