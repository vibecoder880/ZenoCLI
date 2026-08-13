import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import {
  TaskBlock,
  createTaskItem,
} from "./TaskBlock.js";

// Mock the theme provider
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
  resolveSymbols: (unicode: boolean) => ({
    bullet: unicode ? "•" : "-",
    horizontalRule: unicode ? "─" : "---",
    linkArrow: unicode ? "→" : "->",
    success: unicode ? "✓" : "[ok]",
    active: unicode ? "●" : "[>>]",
    pending: unicode ? "○" : "[  ]",
  }),
}));

const unicode = true;

describe("createTaskItem", () => {
  it("creates a TaskItem with the given properties", () => {
    const item = createTaskItem("1", "Do something", "done");
    expect(item).toEqual({ id: "1", label: "Do something", status: "done" });
  });
});

describe("TaskBlock", () => {
  it("renders collapsed summary when expanded is false", () => {
    const items = [
      createTaskItem("1", "Step 1", "done"),
      createTaskItem("2", "Step 2", "active"),
      createTaskItem("3", "Step 3", "pending"),
    ];
    const { lastFrame } = render(
      <TaskBlock title="Plan" items={items} expanded={false} unicode={unicode} />
    );
    expect(lastFrame()).toContain("Plan · 1/3 complete (in progress)");
  });

  it("renders expanded list when expanded is true", () => {
    const items = [
      createTaskItem("1", "Inspect", "done"),
      createTaskItem("2", "Implement", "active"),
      createTaskItem("3", "Test", "pending"),
    ];
    const { lastFrame } = render(
      <TaskBlock title="Plan" items={items} expanded={true} unicode={unicode} />
    );
    expect(lastFrame()).toContain("Plan");
    expect(lastFrame()).toContain("✓ Inspect");
    expect(lastFrame()).toContain("● Implement");
    expect(lastFrame()).toContain("○ Test");
  });

  it("does not show (in progress) when no active items", () => {
    const items = [
      createTaskItem("1", "Step 1", "done"),
      createTaskItem("2", "Step 2", "done"),
    ];
    const { lastFrame } = render(
      <TaskBlock title="Plan" items={items} expanded={false} unicode={unicode} />
    );
    expect(lastFrame()).toContain("Plan · 2/2 complete");
    expect(lastFrame()).not.toContain("in progress");
  });

  it("returns null for empty items", () => {
    const { lastFrame } = render(
      <TaskBlock title="Plan" items={[]} expanded={false} unicode={unicode} />
    );
    expect(lastFrame()).toBe("");
  });

  it("handles all done items", () => {
    const items = [
      createTaskItem("1", "Step 1", "done"),
      createTaskItem("2", "Step 2", "done"),
    ];
    const { lastFrame } = render(
      <TaskBlock title="Plan" items={items} expanded={true} unicode={unicode} />
    );
    expect(lastFrame()).toContain("✓ Step 1");
    expect(lastFrame()).toContain("✓ Step 2");
  });
});
