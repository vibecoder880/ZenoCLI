import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAgentCommand } from "./agent.js";
import type { AgentLoopResult } from "../../agent/loop.js";

class StubProvider {
  readonly name = "Stub";
  readonly slug = "stub";
  readonly authMethods = ["api_key"] as const;

  async *chat() {
    yield { type: "text", content: "stub answer" };
    yield { type: "done", usage: { totalTokens: 4, inputTokens: 2, outputTokens: 2 } };
  }

  async listModels() {
    return [];
  }

  async healthCheck() {
    return { ok: true, message: "OK" };
  }
}

// Route "stub-provider/stub-model" to the stub provider so the command works
// without any real credentials.
vi.mock("../../providers/index.js", () => ({
  createProvider: (slug: string) => {
    if (slug === "stub-provider") {
      return new StubProvider();
    }
    throw new Error(`unexpected provider ${slug}`);
  },
}));

vi.mock("../../storage/config.js", () => ({
  loadConfig: () => ({
    default: { provider: "stub-provider", model: "stub-model", streaming: true },
    context: { ignore: [] },
  }),
}));

vi.mock("../../providers/router-fallback.js", () => ({
  selectUsableRoute: () => ({
    route: { provider: "stub-provider", model: "stub-model" },
    warning: undefined,
  }),
}));

const writeSpy = vi.spyOn(process.stdout, "write");
const originalExitCode = process.exitCode;

beforeEach(() => {
  writeSpy.mockClear();
  process.exitCode = originalExitCode;
});

afterEach(() => {
  process.exitCode = originalExitCode;
  // clearAllMocks (not restoreAllMocks) so the module-level writeSpy stays attached.
  vi.clearAllMocks();
});

async function drainLoop(overrides: Record<string, unknown> = {}) {
  // Stub the loop itself so the command wiring is the subject under test.
  const loopSpy = vi.spyOn(await import("../../agent/loop.js"), "runAgentLoop");
  loopSpy.mockImplementation(async (): Promise<AgentLoopResult> => ({
    message: "final result",
    totalTokens: 4,
    turns: 1,
    toolsUsed: [],
    ...overrides,
  }));
  return loopSpy;
}

describe("agent command non-interactive mode", () => {
  it("prints the plain message without decorative headers when non-interactive", async () => {
    const loopSpy = await drainLoop();

    await runAgentCommand({
      task: "hello",
      cwd: "/tmp",
      nonInteractive: true,
      signal: new AbortController().signal,
    });

    const out = writeSpy.mock.calls.flat().map((c) => String(c)).join("");
    expect(out).toContain("final result");
    expect(out).not.toContain("Agent: stub-provider/stub-model");
    expect(out).not.toContain("---\nTurns:");
    expect(loopSpy).toHaveBeenCalledTimes(1);
  });

  it("sets exitCode 130 when the loop reports an abort", async () => {
    await drainLoop({ aborted: true });

    await runAgentCommand({
      task: "hello",
      cwd: "/tmp",
      nonInteractive: true,
      signal: new AbortController().signal,
    });

    expect(process.exitCode).toBe(130);
  });

  it("keeps interactive mode output by default", async () => {
    await drainLoop();

    await runAgentCommand({
      task: "hello",
      cwd: "/tmp",
      signal: new AbortController().signal,
    });

    const out = writeSpy.mock.calls.flat().map((c) => String(c)).join("");
    expect(out).toContain("Agent: stub-provider/stub-model");
    expect(out).toContain("---\nTurns: 1");
  });
});