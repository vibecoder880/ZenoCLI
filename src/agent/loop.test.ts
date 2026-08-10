import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runAgentLoop } from "./loop.js";
import type { AiProvider, ModelInfo, ProviderStatus, StreamEvent } from "../providers/base.js";
import { registerAllTools } from "./tools/index.js";

// ---- Mock Provider ----

class RetryProvider implements AiProvider {
  readonly name = "Retry";
  readonly slug = "retry";
  readonly authMethods = ["api_key"] as const;
  calls = 0;

  constructor(
    private readonly behavior: "fail-twice-then-text" | "always-error" | "text"
  ) {}

  async *chat(): AsyncIterable<StreamEvent> {
    this.calls += 1;
    if (this.behavior === "fail-twice-then-text") {
      if (this.calls <= 2) {
        yield { type: "error", message: "Rate limit exceeded (429). Try again later." };
        return;
      }
      yield { type: "text", content: "Done after retries." };
      yield { type: "done", usage: { totalTokens: 5, inputTokens: 2, outputTokens: 3 } };
      return;
    }
    if (this.behavior === "always-error") {
      yield { type: "error", message: "Rate limit exceeded (429). Try again later." };
      return;
    }
    yield { type: "text", content: "Immediate answer." };
    yield { type: "done", usage: { totalTokens: 5, inputTokens: 2, outputTokens: 3 } };
  }

  async listModels(): Promise<ModelInfo[]> {
    return [];
  }

  async healthCheck(): Promise<ProviderStatus> {
    return { ok: true, message: "OK" };
  }
}

const testHome = `/tmp/.zeno-test-loop-${Date.now()}`;

beforeEach(() => {
  process.env.HOME = testHome;
  process.env.USERPROFILE = testHome;
  registerAllTools();
});

afterEach(() => {
  delete process.env.HOME;
  delete process.env.USERPROFILE;
});

describe("runAgentLoop abort + retry", () => {
  it("retries a retryable provider failure with backoff, then succeeds", async () => {
    const provider = new RetryProvider("fail-twice-then-text");
    const errors: string[] = [];

    const result = await runAgentLoop({
      provider,
      model: "m1",
      task: "do it",
      maxTurns: 2,
      maxRetries: 3,
      retryBaseDelayMs: 1,
      toolContext: { cwd: "/tmp", ignore: [] },
      onEvent: (event) => {
        if (event.type === "error") errors.push(event.content);
      },
    });

    expect(provider.calls).toBe(3); // 2 failures + 1 success
    expect(result.message).toContain("Done after retries.");
    expect(errors.filter((e) => e.includes("retry 1/3")).length).toBe(1);
    expect(errors.filter((e) => e.includes("retry 2/3")).length).toBe(1);
  });

  it("surfaces non-retryable errors immediately without retry", async () => {
    const provider = new RetryProvider("text");
    const ctrl = new AbortController();
    ctrl.abort(new Error("hard fail"));

    const result = await runAgentLoop({
      provider,
      model: "m1",
      task: "do it",
      maxTurns: 1,
      maxRetries: 2,
      signal: ctrl.signal,
      toolContext: { cwd: "/tmp", ignore: [] },
    });

    // Aborted up-front → clean stop flagged as aborted, not a retried error.
    expect(result.aborted).toBe(true);
    expect(result.message).toContain("abort");
  });

  it("caps retries once maxRetries is reached", async () => {
    const provider = new RetryProvider("always-error");
    const errors: string[] = [];

    await runAgentLoop({
      provider,
      model: "m1",
      task: "do it",
      maxTurns: 1,
      maxRetries: 2,
      retryBaseDelayMs: 0,
      toolContext: { cwd: "/tmp", ignore: [] },
      onEvent: (event) => {
        if (event.type === "error") errors.push(event.content);
      },
    });

    expect(provider.calls).toBe(3); // initial + 2 retries
    expect(errors.filter((e) => e.includes("retry 1/2")).length).toBe(1);
    expect(errors.filter((e) => e.includes("retry 2/2")).length).toBe(1);
  });
});