import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { Conversation, Greeting } from "./Conversation.js";
import { UiThemeProvider } from "../theme/provider.js";

function frameOf(ui: React.ReactNode): string {
  const { lastFrame } = render(
    <UiThemeProvider source={{ colorLevel: "truecolor", nativeBackground: false }}>
      {ui}
    </UiThemeProvider>,
  );
  return lastFrame();
}

describe("<Conversation />", () => {
  it("renders empty state", () => {
    const frame = frameOf(<Conversation messages={[]} unicode />);
    expect(frame).toContain("Type a prompt to begin");
  });

  it("renders user and assistant messages", () => {
    const frame = frameOf(
      <Conversation
        unicode
        messages={[
          { id: "u", role: "user", content: "Fix auth" },
          { id: "a", role: "assistant", content: "I'll trace it." },
        ]}
      />,
    );
    expect(frame).toContain("› Fix auth");
    expect(frame).toContain("I'll trace it.");
  });

  it("renders markdown blocks in assistant content", () => {
    const frame = frameOf(
      <Conversation
        unicode
        messages={[
          {
            id: "a",
            role: "assistant",
            content: "```ts\nconst a = 1;\n```\n\n- one\n- two",
          },
        ]}
      />,
    );
    expect(frame).toContain("const a = 1;");
    expect(frame).toContain("· one");
    expect(frame).toContain("· two");
  });

  it("shows a streaming cursor", () => {
    const frame = frameOf(
      <Conversation
        unicode
        messages={[{ id: "a", role: "assistant", content: "part", streaming: true }]}
      />,
    );
    expect(frame).toContain("part");
    expect(frame).toContain("▍");
  });

  it("collapses assistant messages to a summary line", () => {
    const frame = frameOf(
      <Conversation
        unicode
        messages={[
          {
            id: "a",
            role: "assistant",
            content: "long\nmulti\nline",
            collapsed: true,
            summary: "A short summary",
          },
        ]}
      />,
    );
    expect(frame).toContain("→ A short summary");
    expect(frame).not.toContain("multi");
  });

  it("renders tool lines quietly with muted styling", () => {
    const frame = frameOf(
      <Conversation unicode messages={[{ id: "t", role: "tool", content: "✓ Read 3 files" }]} />,
    );
    expect(frame).toContain("✓ Read 3 files");
  });

  it("hides older messages beyond maxVisible with a marker", () => {
    const messages = Array.from({ length: 5 }, (_, i) => ({
      id: `${i}`,
      role: "assistant" as const,
      content: `msg ${i}`,
    }));
    const frame = frameOf(<Conversation unicode messages={messages} maxVisible={2} />);
    expect(frame).toContain("[3 earlier messages hidden]");
    expect(frame).toContain("msg 4");
    expect(frame).not.toContain("msg 0");
  });
});

describe("<Greeting />", () => {
  it("renders a minimal one-line greeting", () => {
    const frame = frameOf(<Greeting version="0.8.0" cwd="/home/ubuntu/ZenoCLI" providerCount={2} />);
    expect(frame).toContain("ZenoCLI");
    expect(frame).toContain("v0.8.0");
    expect(frame).toContain("2 providers ready");
    expect(frame).toContain("Ask me to build, fix, or explain");
  });
});