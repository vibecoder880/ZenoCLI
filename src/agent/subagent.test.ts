import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { getSubagentStats, spawnTypedSubagent } from "./subagent.js";
import type { AiProvider, ModelInfo, ProviderStatus, StreamEvent } from "../providers/base.js";

// ---- Mock Provider ----

class MockProvider implements AiProvider {
  readonly name = "Mock";
  readonly slug = "mock";
  readonly authMethods = ["api_key"] as const;

  async *chat(): AsyncIterable<StreamEvent> {
    yield { type: "text", content: "Mock response" };
    yield { type: "done", usage: { totalTokens: 10, inputTokens: 5, outputTokens: 5 } };
  }

  async listModels(): Promise<ModelInfo[]> {
    return [];
  }

  async healthCheck(): Promise<ProviderStatus> {
    return { ok: true, message: "OK" };
  }
}

const testDir = path.join(os.tmpdir(), `.zeno-test-subagent-${Date.now()}`);

beforeEach(() => {
  process.env.HOME = testDir;
  process.env.USERPROFILE = testDir;
});

afterEach(() => {
  delete process.env.HOME;
  delete process.env.USERPROFILE;
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

describe("Subagent", () => {
  it("spawns a researcher subagent", async () => {
    const result = await spawnTypedSubagent("researcher", {
      task: "Find all TypeScript files in the project",
      provider: new MockProvider(),
      cwd: "/tmp",
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain("Mock");
    expect(result.tokensUsed).toBe(10);
  });

  it("spawns a coder subagent", async () => {
    const result = await spawnTypedSubagent("coder", {
      task: "Add a new function to the codebase",
      provider: new MockProvider(),
      cwd: "/tmp",
    });

    expect(result.success).toBe(true);
    expect(result.turns).toBeGreaterThan(0);
  });

  it("returns success=false on timeout", async () => {
    class SlowProvider implements AiProvider {
      readonly name = "Slow";
      readonly slug = "slow";
      readonly authMethods = ["api_key"] as const;

      async *chat(): AsyncIterable<StreamEvent> {
        await new Promise((resolve) => setTimeout(resolve, 100));
        yield { type: "text", content: "slow" };
        yield { type: "done", usage: { totalTokens: 5 } };
      }

      async listModels(): Promise<ModelInfo[]> {
        return [];
      }

      async healthCheck(): Promise<ProviderStatus> {
        return { ok: true, message: "OK" };
      }
    }

    const result = await spawnTypedSubagent("researcher", {
      task: "Test",
      provider: new SlowProvider(),
      cwd: "/tmp",
      timeout: 50, // Very short timeout
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("timeout");
  });
});

describe("getSubagentStats", () => {
  it("returns current stats", () => {
    const stats = getSubagentStats();
    expect(stats).toHaveProperty("active");
    expect(stats).toHaveProperty("total");
    expect(stats).toHaveProperty("maxConcurrent");
    expect(stats.maxConcurrent).toBeGreaterThan(0);
  });
});
