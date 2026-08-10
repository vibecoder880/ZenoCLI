import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rmSync } from "node:fs";
import { runContextInitCommand, runContextSetCommand, runContextShowCommand } from "./context.js";

const tempDir = "D:/VibeCoder/ZenoCLI/.tmp-context-workspace";

describe("context commands", () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  beforeEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    log.mockClear();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates and shows a context file", () => {
    runContextInitCommand(tempDir);
    runContextSetCommand(tempDir, "# ZENO.md\nUse tests first.");
    runContextShowCommand(tempDir);

    expect(log.mock.calls.flat().join("\n")).toContain("Use tests first.");
  });
});
