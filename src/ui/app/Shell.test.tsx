import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { Shell } from "./Shell.js";

const caps = {
  colorLevel: "truecolor" as const,
  noColor: false,
  unicode: true,
  osc8Links: true,
  columns: 120,
  rows: 30,
  platform: "linux" as NodeJS.Platform,
  nativeBackground: false,
};

const baseProps = {
  version: "0.8.0",
  provider: "anthropic",
  model: "claude-sonnet-5",
  branch: "khanh",
  cwd: "/home/ubuntu/ZenoCLI",
  contextPct: 18,
  messages: [
    { id: "1", role: "user" as const, content: "Fix auth" },
    { id: "2", role: "assistant" as const, content: "I'll trace the flow." },
  ],
  input: "",
  busy: false,
  firstRun: false,
  providersReady: 1,
  onInputChange: () => {},
  onSubmit: () => {},
  capabilities: caps,
};

describe("<Shell />", () => {
  it("renders header, conversation, input, and statusline", () => {
    const { lastFrame } = render(<Shell {...baseProps} />);
    const frame = lastFrame();
    expect(frame).toContain("ZENO");
    expect(frame).toContain("Fix auth");
    expect(frame).toContain("I'll trace the flow.");
    expect(frame).toContain("claude-sonnet-5");
    expect(frame).toContain("18%");
  });

  it("shows the greeting instead of the empty conversation on first run", () => {
    const { lastFrame } = render(
      <Shell {...baseProps} firstRun messages={[]} providersReady={2} />,
    );
    const frame = lastFrame();
    expect(frame).toContain("Ask me to build, fix, or explain");
    expect(frame).toContain("2 providers ready");
  });

  it("uses ASCII symbols when unicode is unavailable", () => {
    const noUnicode = { ...caps, unicode: false };
    const { lastFrame } = render(
      <Shell {...baseProps} capabilities={noUnicode} input="" />,
    );
    const frame = lastFrame();
    // The user message renders with the ASCII ">" prefix, not "›".
    expect(frame).toContain("> Fix auth");
  });

  it("hides the statusline in compact widths", () => {
    const compact = { ...caps, columns: 60 };
    const { lastFrame } = render(
      <Shell {...baseProps} capabilities={compact} messages={[]} />,
    );
    const frame = lastFrame();
    expect(frame).toContain("Type a prompt to begin");
    // Statusline hidden; no "18%" context section at narrow width.
    expect(frame).not.toContain("18%");
  });
});