import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  collectSensitiveValues,
  clearSensitiveValuesCache,
  redactSensitive,
  shouldRedactTool,
} from "./redact.js";

describe("Secret Redaction", () => {
  beforeEach(() => {
    clearSensitiveValuesCache();
    vi.unstubAllEnvs();
  });

  it("collects secrets from environment variables matching secret patterns", () => {
    vi.stubEnv("API_KEY", "sk-1234567890abcdef");
    vi.stubEnv("SECRET_TOKEN", "my-secret-value");
    vi.stubEnv("AUTH", "auth-value-123");

    const values = collectSensitiveValues();
    expect(values).toContain("sk-1234567890abcdef");
    expect(values).toContain("my-secret-value");
    expect(values).toContain("auth-value-123");
  });

  it("collects long environment values (>= 12 chars) even without secret key pattern", () => {
    vi.stubEnv("LONG_VALUE", "this-is-a-very-long-value-12345");

    const values = collectSensitiveValues();
    expect(values).toContain("this-is-a-very-long-value-12345");
  });

  it("skips PATH-like environment variables", () => {
    vi.stubEnv("PATH", "/usr/bin:/bin");
    vi.stubEnv("NODE_PATH", "/usr/lib/node_modules");
    vi.stubEnv("SECRET_PATH_KEY", "should-be-redacted");

    const values = collectSensitiveValues();
    expect(values).not.toContain("/usr/bin:/bin");
    expect(values).not.toContain("/usr/lib/node_modules");
    // Key contains PATH but is not *PATH* - it has SECRET_PATH_KEY, which should be caught by KEY pattern
    expect(values).toContain("should-be-redacted");
  });

  it("skips empty and short environment values (< 4 chars)", () => {
    vi.stubEnv("EMPTY", "");
    vi.stubEnv("SHORT", "a");
    vi.stubEnv("SHORT2", "ab");
    vi.stubEnv("SHORT3", "abc");
    // VALID doesn't match secret patterns and value is only 4 chars (< 12), so should NOT be collected
    vi.stubEnv("VALID", "abcd");
    // But KEY pattern with 4-char value SHOULD be collected - use different value
    vi.stubEnv("MY_API_KEY", "keyval");

    const values = collectSensitiveValues();
    expect(values).not.toContain("");
    expect(values).not.toContain("a");
    expect(values).not.toContain("ab");
    expect(values).not.toContain("abc");
    expect(values).not.toContain("abcd"); // VALID not collected (no secret pattern, value < 12)
    // MY_API_KEY with value "keyval" should be collected (matches KEY pattern)
    expect(values).toContain("keyval");
  });

  it("redacts environment secret values in tool output", () => {
    vi.stubEnv("MY_API_KEY", "sk-live-abcdefghijklmnop");

    const output = "The command returned: sk-live-abcdefghijklmnop";
    const redacted = redactSensitive(output);
    expect(redacted).toBe("The command returned: [REDACTED]");
  });

  it("redacts auth profile secrets in tool output", async () => {
    // Mock the AuthProfileStore to return a fake profile
    vi.doMock("../auth/auth-profiles.js", () => {
      return {
        AuthProfileStore: vi.fn().mockImplementation(() => ({
          listProfiles: () => [
            {
              type: "api_key",
              provider: "openai",
              key: "sk-test-1234567890",
              id: "test-id",
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ],
        })),
      };
    });

    // Need to re-import to get the mocked version
    vi.resetModules();
    const mod = await import("./redact.js");
    const { redactSensitive: redactedFn, clearSensitiveValuesCache: clearCache } = mod;
    clearCache();

    const output = "API key is sk-test-1234567890";
    const redacted = redactedFn(output);
    expect(redacted).toBe("API key is [REDACTED]");
  });

  it("does not produce false positives on benign text", () => {
    vi.stubEnv("API_KEY", "sk-secret123");

    const benign = "This is a normal message without any secrets.";
    const redacted = redactSensitive(benign);
    expect(redacted).toBe(benign);
  });

  it("longest match wins - longer secret beats shorter secret", () => {
    vi.stubEnv("API_KEY_ABC", "abcdefghijkl"); // length 12, matches KEY pattern
    vi.stubEnv("SECRET_TOKEN", "abcxyz"); // length 6, matches TOKEN pattern (ends with TOKEN)

    const output = "Found abcdefghijkl and abcxyz here";
    const redacted = redactSensitive(output);
    // "abcdefghijkl" (12 chars) should be redacted first, then "abcxyz" (6 chars)
    expect(redacted).toBe("Found [REDACTED] and [REDACTED] here");
  });

  it("redaction never throws when auth profile unreadable", async () => {
    // Mock AuthProfileStore to throw on load
    vi.doMock("../auth/auth-profiles.js", () => {
      return {
        AuthProfileStore: vi.fn().mockImplementation(() => ({
          listProfiles: () => {
            throw new Error("Cannot read auth profiles");
          },
        })),
      };
    });

    vi.resetModules();
    const mod = await import("./redact.js");
    const { redactSensitive: redactedFn, clearSensitiveValuesCache: clearCache } = mod;
    clearCache();

    // Should not throw even with auth profile error
    const output = "Some output with no env secrets";
    const redacted = redactedFn(output);
    expect(redacted).toBe(output);
  });

  it("shouldRedactTool returns true for denylisted tools", () => {
    expect(shouldRedactTool("run_command")).toBe(true);
    expect(shouldRedactTool("web_fetch")).toBe(true);
    expect(shouldRedactTool("read_file")).toBe(true);
    expect(shouldRedactTool("edit_file")).toBe(true);
    expect(shouldRedactTool("write_file")).toBe(true);
    expect(shouldRedactTool("grep")).toBe(true);
  });

  it("shouldRedactTool returns true for MCP tools", () => {
    expect(shouldRedactTool("mcp__server__tool")).toBe(true);
    expect(shouldRedactTool("mcp__github__list_repos")).toBe(true);
  });

  it("shouldRedactTool returns false for orchestration tools", () => {
    expect(shouldRedactTool("ask_user")).toBe(false);
    expect(shouldRedactTool("task_tool")).toBe(false);
    expect(shouldRedactTool("plan_tool")).toBe(false);
  });

  it("handles multiple occurrences of the same secret", () => {
    vi.stubEnv("TOKEN", "secret123");

    const output = "token: secret123, again: secret123, third: secret123";
    const redacted = redactSensitive(output);
    expect(redacted).toBe("token: [REDACTED], again: [REDACTED], third: [REDACTED]");
  });

  it("handles special regex characters in secrets", () => {
    vi.stubEnv("SPECIAL_KEY", "a.b*c?d+e");

    const output = "Value is a.b*c?d+e";
    const redacted = redactSensitive(output);
    expect(redacted).toBe("Value is [REDACTED]");
  });

  it("returns empty string unchanged", () => {
    expect(redactSensitive("")).toBe("");
  });

  it("returns text without secrets unchanged when no secrets collected", () => {
    clearSensitiveValuesCache();
    // No env stubs, so no secrets collected
    const output = "Hello world";
    const redacted = redactSensitive(output);
    expect(redacted).toBe("Hello world");
  });
});