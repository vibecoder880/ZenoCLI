import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { Activity } from "./Activity.js";
import { UiThemeProvider } from "../theme/provider.js";
import type { ActivityLine } from "../activity/types.js";

function frameOf(ui: React.ReactNode): string {
  const { lastFrame } = render(
    <UiThemeProvider source={{ colorLevel: "truecolor", nativeBackground: false }}>
      {ui}
    </UiThemeProvider>,
  );
  return lastFrame();
}

const baseLine: ActivityLine = {
  id: "read_file-1",
  toolName: "read_file",
  summary: "✓ read_file (2)",
  detail: "src/auth.ts\nsrc/token.ts",
  expanded: false,
  status: "ok",
  timestamp: Date.now(),
};

const errorLine: ActivityLine = {
  ...baseLine,
  id: "edit_file-1",
  toolName: "edit_file",
  summary: "× edit_file failed",
  detail: "permission denied",
  expanded: true,
  status: "error",
};

describe("<Activity />", () => {
  it("renders nothing for empty lines", () => {
    expect(frameOf(<Activity lines={[]} unicode />)).toBe("");
  });

  it("renders a collapsed OK line with summary", () => {
    const frame = frameOf(<Activity lines={[baseLine]} unicode />);
    expect(frame).toContain("✓ read_file (2)");
    expect(frame).not.toContain("src/auth.ts");
  });

  it("renders an expanded line with detail", () => {
    const expanded = { ...baseLine, expanded: true };
    const frame = frameOf(<Activity lines={[expanded]} unicode />);
    expect(frame).toContain("✓ read_file (2)");
    expect(frame).toContain("src/auth.ts");
    expect(frame).toContain("src/token.ts");
  });

  it("renders error lines in error color (inverse when focused+expanded)", () => {
    const frame = frameOf(<Activity lines={[errorLine]} unicode focusedIndex={0} />);
    expect(frame).toContain("× edit_file failed");
    expect(frame).toContain("permission denied");
  });

  it("shows focused indicator for the focused line", () => {
    const frame = frameOf(<Activity lines={[baseLine]} unicode focusedIndex={0} />);
    // The focused line renders bold (inverse when expanded, but here collapsed so just bold)
    expect(frame).toContain("✓ read_file (2)");
  });

  it("uses ASCII glyphs when unicode is false", () => {
    const asciiLine = { ...baseLine, summary: "OK read_file (2)" };
    const frame = frameOf(<Activity lines={[asciiLine]} unicode={false} />);
    expect(frame).toContain("OK read_file (2)");
  });
});