import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runAuthHealth } from "./auth.js";
import { AuthProfileStore } from "../../auth/auth-profiles.js";

const tempHome = path.join(os.tmpdir(), `.zeno-test-auth-${Date.now()}`);
const originalExitCode = process.exitCode;

beforeEach(() => {
  rmSync(tempHome, { recursive: true, force: true });
  vi.stubEnv("HOME", tempHome);
  vi.stubEnv("USERPROFILE", tempHome);
  process.exitCode = originalExitCode;
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(tempHome, { recursive: true, force: true });
  process.exitCode = originalExitCode;
});

describe("auth health", () => {
  it("reports an unconfigured store as unhealthy (exit 1)", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    runAuthHealth();

    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("✗ openai: not configured");
    expect(output).toContain("✗ anthropic: not configured");
    expect(process.exitCode).toBe(1);
    log.mockRestore();
  });

  it("reports a valid stored profile as healthy", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const store = new AuthProfileStore();
    store.saveProfile({ type: "api_key", provider: "openai", key: "sk-test-12345678", label: "default" });

    runAuthHealth("openai");

    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("✓ openai: api_key profile");
    expect(process.exitCode).toBe(undefined);

    log.mockRestore();
  });

  it("flags an expired OAuth profile as unhealthy", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const store = new AuthProfileStore();
    const now = Date.now();
    store.saveProfile({
      type: "oauth",
      provider: "google",
      access: "access-token",
      refresh: "refresh-token",
      expires: now - 1000,
      email: "u@example.com"
    });

    runAuthHealth("google");

    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("✗ google: active profile");
    expect(process.exitCode).toBe(1);

    log.mockRestore();
  });
});