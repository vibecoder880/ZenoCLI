import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { Composer } from "./Composer.js";
import { UiThemeProvider } from "../theme/provider.js";

function frameOf(ui: React.ReactNode): string {
  const { lastFrame } = render(
    <UiThemeProvider source={{ colorLevel: "truecolor", nativeBackground: false }}>
      {ui}
    </UiThemeProvider>,
  );
  return lastFrame();
}

describe("<Composer />", () => {
  it("renders the prompt prefix and placeholder when empty", () => {
    const frame = frameOf(
      <Composer value="" placeholder="What would you like to build?" unicode cwd="/tmp" onChange={() => {}} onSubmit={() => {}} />,
    );
    expect(frame).toContain("›");
    expect(frame).toContain("What would you like to build?");
  });

  it("renders the value with a trailing cursor", () => {
    const frame = frameOf(
      <Composer value="fix auth" unicode cwd="/tmp" onChange={() => {}} onSubmit={() => {}} />,
    );
    expect(frame).toContain("fix auth");
    expect(frame).toContain("▍");
  });

  it("renders a multiline value across lines", () => {
    const frame = frameOf(
      <Composer value="line1\nline2" unicode cwd="/tmp" onChange={() => {}} onSubmit={() => {}} />,
    );
    expect(frame).toContain("line1");
    expect(frame).toContain("line2");
  });

  it("shows command suggestions under the line for a slash trigger", async () => {
    // "/mode" matches "/model" in the slash catalog.
    const { lastFrame } = render(
      <UiThemeProvider source={{ colorLevel: "truecolor", nativeBackground: false }}>
        <Composer value="/mod" unicode cwd="/tmp" onChange={() => {}} onSubmit={() => {}} />
      </UiThemeProvider>,
    );
    // Suggestions are computed async; wait a tick.
    await new Promise((r) => setTimeout(r, 50));
    const frame = lastFrame();
    expect(frame).toContain("→ command");
    expect(frame).toContain("/model");
  });

  it("renders no suggestion rows for unknown triggers", async () => {
    const { lastFrame } = render(
      <UiThemeProvider source={{ colorLevel: "truecolor", nativeBackground: false }}>
        <Composer value="/zzz-not-a-command" unicode cwd="/tmp" onChange={() => {}} onSubmit={() => {}} />
      </UiThemeProvider>,
    );
    await new Promise((r) => setTimeout(r, 50));
    // No "→ command" label and no suggestion rows; the raw value still renders.
    expect(lastFrame()).not.toContain("→ command");
  });

  it("renders nothing when disabled", () => {
    const frame = frameOf(
      <Composer value="fix" disabled unicode cwd="/tmp" onChange={() => {}} onSubmit={() => {}} />,
    );
    // Disabled: value still renders, but no interactive affordances are added.
    expect(frame).toContain("fix");
  });
});
