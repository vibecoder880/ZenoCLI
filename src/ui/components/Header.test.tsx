import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { Header } from "./Header.js";

const baseProps = {
  version: "0.8.0",
  provider: "anthropic",
  model: "claude-sonnet-5",
  branch: "khanh",
  cwd: "/home/ubuntu/ZenoCLI",
  contextPct: 18,
  status: "idle" as const,
};

describe("<Header />", () => {
  it("renders brand, version, model, branch, cwd, and context in wide tier", () => {
    const { lastFrame } = render(<Header {...baseProps} widthTier="wide" />);
    const frame = lastFrame();
    expect(frame).toContain("ZENO");
    expect(frame).toContain("v0.8.0");
    expect(frame).toContain("anthropic/claude-sonnet-5");
    expect(frame).toContain("khanh");
    expect(frame).toContain("/home/ubuntu/ZenoCLI");
    expect(frame).toContain("18%");
  });

  it("shows thinking status when busy", () => {
    const { lastFrame } = render(<Header {...baseProps} status="thinking" />);
    expect(lastFrame()).toContain("thinking");
  });

  it("shows agent count when agents are running", () => {
    const { lastFrame } = render(<Header {...baseProps} status="agents" agents={2} />);
    expect(lastFrame()).toContain("2 agents");
  });

  it("collapses to essentials when narrow", () => {
    const { lastFrame } = render(<Header {...baseProps} widthTier="narrow" />);
    const frame = lastFrame();
    expect(frame).toContain("ZENO");
    expect(frame).toContain("claude-sonnet-5");
    // Narrow: no cwd, no context %.
    expect(frame).not.toContain("/home/ubuntu/ZenoCLI");
    expect(frame).not.toContain("18%");
  });

  it("shows cwd but no context in medium tier", () => {
    const { lastFrame } = render(<Header {...baseProps} widthTier="medium" />);
    const frame = lastFrame();
    expect(frame).toContain("/home/ubuntu/ZenoCLI");
    expect(frame).not.toContain("18%");
  });

  it("shows cwd and context in wide tier", () => {
    const { lastFrame } = render(<Header {...baseProps} widthTier="wide" />);
    const frame = lastFrame();
    expect(frame).toContain("/home/ubuntu/ZenoCLI");
    expect(frame).toContain("18%");
  });
});