import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runConfigSetCommand, runConfigShowCommand } from "./config.js";

const tempHome = path.join(os.tmpdir(), `.zeno-test-config-${Date.now()}`);

describe("config commands", () => {
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

  it("updates alias values", () => {
    runConfigSetCommand("aliases.review", "anthropic/claude-sonnet-4-0");
    runConfigShowCommand();

    expect(log.mock.calls.flat().join("\n")).toContain("review -> anthropic/claude-sonnet-4-0");
  });
});
