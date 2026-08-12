import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { appendHistoryEntry } from "../../storage/history.js";
import { runCostCommand, runHistoryClearCommand, runHistoryListCommand, runHistoryShowCommand } from "./history.js";

const tempHome = path.join(os.tmpdir(), `.zeno-test-command-history-${Date.now()}`);

describe("history commands", () => {
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

  it("lists, shows, and clears stored history", () => {
    const entry = appendHistoryEntry({
      cwd: tempHome,
      provider: "openai",
      model: "gpt-5.6-terra",
      prompt: "hello",
      response: "world",
      totalTokens: 12,
      estimatedCostUsd: 0.0001
    });

    runHistoryListCommand(1);
    runHistoryShowCommand(entry.id);
    runCostCommand();
    runHistoryClearCommand();

    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain(entry.id);
    expect(output).toContain("Estimated total cost (USD): $0.000100");
    expect(output).toContain("Removed 1 history entries.");
  });
});
