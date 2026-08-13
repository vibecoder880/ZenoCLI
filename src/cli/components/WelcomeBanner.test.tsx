import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { WelcomeBanner } from "./WelcomeBanner.js";

describe("<WelcomeBanner />", () => {
  it("renders logo, version, and cwd", () => {
    const { lastFrame } = render(
      <WelcomeBanner
        version="0.2.0"
        cwd="/tmp/work"
        providers={[
          { slug: "openai", status: "ok" },
          { slug: "anthropic", status: "missing" }
        ]}
        missingProviders={["anthropic"]}
      />,
    );
    const frame = lastFrame();
    expect(frame).toContain("v0.2.0");
    expect(frame).toContain("/tmp/work");
    expect(frame).toContain("openai");
    expect(frame).toContain("anthropic");
  });

  it("renders the ZENO ASCII logo (not the legacy NEURO art)", () => {
    const { lastFrame } = render(
      <WelcomeBanner
        version="0.2.0"
        cwd="/tmp"
        providers={[]}
        missingProviders={[]}
      />,
    );
    const frame = lastFrame();
    // The block-letter "Z" row of the ZENO logo.
    expect(frame).toContain("██╗   ██╗███████╗███╗   ██╗ ██████╗");
  });

  it("shows auth warning when providers are missing", () => {
    const { lastFrame } = render(
      <WelcomeBanner
        version="0.2.0"
        cwd="/tmp"
        providers={[{ slug: "openai", status: "missing" }]}
        missingProviders={["openai"]}
      />,
    );
    expect(lastFrame()).toContain("Missing auth");
    expect(lastFrame()).toContain("zeno auth");
  });

  it("does not show auth warning when all providers are ok", () => {
    const { lastFrame } = render(
      <WelcomeBanner
        version="0.2.0"
        cwd="/tmp"
        providers={[{ slug: "openai", status: "ok" }]}
        missingProviders={[]}
      />,
    );
    expect(lastFrame()).not.toContain("Missing auth");
  });
});
