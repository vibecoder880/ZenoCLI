/**
 * Zeno UI v2 — Performance benchmarks (Phase 13).
 *
 * These tests verify that virtualization works correctly:
 * - Only maxVisible messages are rendered regardless of total count
 * - Streaming updates are efficient
 * - Large conversations don't cause memory issues
 *
 * Note: ink-testing-library has significant setup overhead (~500ms per render).
 * We test correctness of virtualization, not raw render speed.
 *
 * Run with: npm run test -- src/ui/render/benchmarks.test.ts
 */

import { describe, expect, it } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Conversation, type ChatLine } from "../components/Conversation.js";

// Generate a large conversation for benchmarking
function generateMessages(count: number, avgLinesPerMsg = 10): ChatLine[] {
  const messages: ChatLine[] = [];
  for (let i = 0; i < count; i++) {
    const lines = Array.from({ length: avgLinesPerMsg }, (_, j) =>
      `Line ${j + 1} of message ${i + 1}: This is a sample assistant response with some content to render.`
    ).join("\n");
    messages.push({
      id: `msg-${i}`,
      role: i % 3 === 0 ? "user" : "assistant",
      content: i % 3 === 0 ? `User prompt ${i}` : lines,
    });
  }
  return messages;
}

describe("Performance benchmarks", () => {
  it("virtualizes: only maxVisible messages are rendered", { timeout: 15000 }, () => {
    const messages = generateMessages(500, 5);
    const { lastFrame } = render(
      React.createElement(Conversation, {
        messages,
        unicode: true,
        maxVisible: 50,
      })
    );
    const frame = lastFrame();

    // Should show hidden count marker (500 messages - 50 visible = 450 hidden)
    expect(frame).toContain("[450 earlier messages hidden]");

    // Should contain content from recent messages (last 50)
    // Messages are 1-indexed in content (i+1), so last message has "message 500"
    expect(frame).toContain("message 500");
    // First visible assistant message is at index 451, content shows "message 452" (i+1)
    expect(frame).toContain("message 452");

    // Should NOT contain content from early messages
    expect(frame).not.toContain("message 1");
    expect(frame).not.toContain("message 100");
  });

  it("streaming update works correctly", () => {
    const messages: ChatLine[] = [
      { id: "user-1", role: "user", content: "Hello" },
      {
        id: "streaming-1",
        role: "assistant",
        content: "This is a streaming",
        streaming: true,
      },
    ];

    const { rerender, lastFrame } = render(
      React.createElement(Conversation, {
        messages,
        unicode: true,
        maxVisible: 50,
      })
    );

    expect(lastFrame()).toContain("This is a streaming");

    // Update streaming message
    const updatedMessages = [...messages];
    updatedMessages[1] = {
      ...messages[1],
      content: "This is a streaming response that is complete.",
      streaming: false,
    };

    rerender(
      React.createElement(Conversation, {
        messages: updatedMessages,
        unicode: true,
        maxVisible: 50,
      })
    );

    expect(lastFrame()).toContain("This is a streaming response that is complete.");
  });

  it("handles large conversations without error", { timeout: 15000 }, () => {
    const messages = generateMessages(1000, 3);
    const { lastFrame } = render(
      React.createElement(Conversation, {
        messages,
        unicode: true,
        maxVisible: 50,
      })
    );
    const frame = lastFrame();

    // Should show hidden count
    expect(frame).toContain("[950 earlier messages hidden]");

    // Should render successfully
    expect(frame).toContain("message 999");
  });
});
