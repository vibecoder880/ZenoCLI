import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { runInitCommand } from "./init.js";

const tempWorkspace = "D:/VibeCoder/ZenoCLI/.tmp-init-workspace";

describe("init command", () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  beforeEach(() => {
    rmSync(tempWorkspace, { recursive: true, force: true });
    log.mockClear();
  });

  afterEach(() => {
    rmSync(tempWorkspace, { recursive: true, force: true });
  });

  it("creates bootstrap files for a workspace", () => {
    runInitCommand(tempWorkspace);

    expect(existsSync(path.join(tempWorkspace, "ZENO.md"))).toBe(true);
    expect(existsSync(path.join(tempWorkspace, ".env.example"))).toBe(true);
    expect(log.mock.calls.flat().join("\n")).toContain("Initialized ZenoCLI workspace");
  });
});
