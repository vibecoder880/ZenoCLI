import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { OverlayLayer } from "./OverlayLayer.js";

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

describe("OverlayLayer", () => {
  it("renders palette overlay with title and items", () => {
    const { lastFrame } = render(
      <OverlayLayer
        overlay={{ kind: "palette", items: ["/help", "/model", "/clear"], selectedIndex: 1 }}
        unicode={true}
      />
    );
    expect(lastFrame()).toContain("/help");
    expect(lastFrame()).toContain("/model");
    expect(lastFrame()).toContain("/clear");
  });

  it("highlights selected item", () => {
    const { lastFrame } = render(
      <OverlayLayer
        overlay={{ kind: "palette", items: ["/help", "/model"], selectedIndex: 0 }}
        unicode={true}
      />
    );
    expect(lastFrame()).toContain("● /help");
  });

  it("renders permission prompt with action hints", () => {
    const { lastFrame } = render(
      <OverlayLayer
        overlay={{
          kind: "permission",
          items: ["Zeno wants to run: npm install", "Directory: ~/Projects"],
          selectedIndex: 0,
          title: "Permission Required",
        }}
        unicode={true}
      />
    );
    expect(lastFrame()).toContain("Permission Required");
    expect(lastFrame()).toContain("npm install");
    expect(lastFrame()).toContain("Enter Allow");
  });

  it("returns null when overlay is null", () => {
    const { lastFrame } = render(
      <OverlayLayer overlay={null as any} unicode={true} />
    );
    expect(lastFrame()).toBe("");
  });

  it("renders title when provided", () => {
    const { lastFrame } = render(
      <OverlayLayer
        overlay={{ kind: "model", items: ["gpt-5", "claude-5"], selectedIndex: 0, title: "Pick model" }}
        unicode={true}
      />
    );
    expect(lastFrame()).toContain("Pick model");
  });
});
