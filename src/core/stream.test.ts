import { describe, expect, it, vi } from "vitest";
import { collectProviderText } from "./stream.js";
import type { AiProvider, ModelInfo, ProviderStatus, StreamEvent } from "../providers/base.js";

// ---- Mock Provider ----

class StreamProvider implements AiProvider {
  readonly name = "Stream";
  readonly slug = "stream";
  readonly authMethods = ["api_key"] as const;

  constructor(private readonly events: AsyncIterable<StreamEvent>) {}

  chat(): AsyncIterable<StreamEvent> {
    return this.events;
  }

  async listModels(): Promise<ModelInfo[]> {
    return [];
  }

  async healthCheck(): Promise<ProviderStatus> {
    return { ok: true, message: "OK" };
  }
}

async function* eventSource(chunks: string[]): AsyncIterable<StreamEvent> {
  for (const chunk of chunks) {
    yield { type: "text", content: chunk };
  }
  yield { type: "done", usage: { totalTokens: 7, inputTokens: 3, outputTokens: 4 } };
}

describe("collectProviderText", () => {
  it("accumulates text chunks and usage", async () => {
    const provider = new StreamProvider(eventSource(["Hello", " world"]));
    const onText = vi.fn();

    const result = await collectProviderText(provider, "m1", [{ role: "user", content: "hi" }], onText);

    expect(result.text).toBe("Hello world");
    expect(onText).toHaveBeenCalledTimes(2);
    expect(result.totalTokens).toBe(7);
    expect(result.inputTokens).toBe(3);
    expect(result.outputTokens).toBe(4);
  });

  it("throws immediately when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(new Error("cancelled"));
    const provider = new StreamProvider(eventSource(["loops", "forever"]));

    await expect(
      collectProviderText(provider, "m1", [{ role: "user", content: "hi" }], undefined, undefined, controller.signal)
    ).rejects.toThrow("cancelled");
  });

  it("stops mid-stream when the signal aborts between chunks", async () => {
    const controller = new AbortController();
    const provider = new StreamProvider(
      // The first chunk is already buffered; the abort fires before the second.
      (async function* () {
        yield { type: "text", content: "first" };
        await new Promise((r) => setTimeout(r, 25));
        controller.abort(new Error("stop here"));
        yield { type: "text", content: "second" };
        yield { type: "done" };
      })()
    );

    await expect(
      collectProviderText(provider, "m1", [{ role: "user", content: "hi" }], undefined, undefined, controller.signal)
    ).rejects.toThrow("stop here");
  });
});