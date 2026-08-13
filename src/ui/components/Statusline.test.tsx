import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { Statusline } from "./Statusline.js";

describe("<Statusline />", () => {
  it("renders sections in canonical order with separators", () => {
    const { lastFrame } = render(
      <Statusline
        sections={[
          { key: "model", text: "claude-sonnet-5" },
          { key: "branch", text: "khanh" },
          { key: "context", text: "18%" },
        ]}
      />,
    );
    const frame = lastFrame();
    // branch ranks before model; all three present.
    expect(frame).toContain("khanh");
    expect(frame).toContain("claude-sonnet-5");
    expect(frame).toContain("18%");
  });

  it("appends duration", () => {
    const { lastFrame } = render(
      <Statusline sections={[{ key: "model", text: "gpt-5.6-terra" }]} duration="2m41s" />,
    );
    expect(lastFrame()).toContain("2m41s");
  });

  it("filters to narrow sections when compact", () => {
    const { lastFrame } = render(
      <Statusline
        compact
        sections={[
          { key: "branch", text: "khanh" },
          { key: "model", text: "claude-sonnet-5" },
          { key: "tokens", text: "12 msgs" },
        ]}
      />,
    );
    const frame = lastFrame();
    expect(frame).toContain("claude-sonnet-5");
    expect(frame).not.toContain("khanh");
    expect(frame).not.toContain("12 msgs");
  });

  it("renders nothing for empty sections", () => {
    const { lastFrame } = render(<Statusline sections={[]} />);
    expect(lastFrame()).toBe("");
  });
});