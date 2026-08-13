import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { AgentActivity } from "./AgentActivity.js";

vi.mock("../theme/provider.js", () => ({
  useUiTheme: () => ({
    noColor: true,
    palette: {
      text: "white",
      muted: "gray",
      subtle: "gray",
      accent: "blue",
      success: "green",
      warning: "yellow",
      error: "red",
    },
  }),
}));

vi.mock("../render/markdown.js", () => ({
  resolveSymbols: () => ({
    bullet: "•",
    horizontalRule: "─",
    linkArrow: "→",
    success: "✓",
    active: "●",
    pending: "○",
  }),
}));

describe("AgentActivity", () => {
  it("renders running agents with count", () => {
    const { lastFrame } = render(
      <AgentActivity
        agents={[
          { id: "1", name: "researcher", status: "running" },
          { id: "2", name: "tester", status: "running" },
        ]}
        unicode={true}
      />
    );
    expect(lastFrame()).toContain("2 agents running");
    expect(lastFrame()).toContain("researcher");
    expect(lastFrame()).toContain("tester");
  });

  it("renders mixed status agents", () => {
    const { lastFrame } = render(
      <AgentActivity
        agents={[
          { id: "1", name: "researcher", status: "running" },
          { id: "2", name: "tester", status: "completed" },
        ]}
        unicode={true}
      />
    );
    expect(lastFrame()).toContain("1 agent running");
    expect(lastFrame()).toContain("researcher");
    expect(lastFrame()).toContain("tester");
  });

  it("returns null for empty agents", () => {
    const { lastFrame } = render(
      <AgentActivity agents={[]} unicode={true} />
    );
    expect(lastFrame()).toBe("");
  });

  it("renders single agent", () => {
    const { lastFrame } = render(
      <AgentActivity
        agents={[{ id: "1", name: "coder", status: "running" }]}
        unicode={true}
      />
    );
    expect(lastFrame()).toContain("1 agent running");
    expect(lastFrame()).toContain("coder");
  });
});
