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
  });

  it("renders the ZENO ASCII logo", () => {
    const { lastFrame } = render(
      <WelcomeBanner
        version="0.2.0"
        cwd="/tmp"
        providers={[]}
        missingProviders={[]}
      />,
    );
    const frame = lastFrame();
    expect(frame).toContain("███████╗");
  });

  it("only shows configured providers, not missing ones", () => {
    const { lastFrame } = render(
      <WelcomeBanner
        version="0.2.0"
        cwd="/tmp"
        providers={[
          { slug: "openai", status: "ok" },
          { slug: "anthropic", status: "missing" }
        ]}
        missingProviders={["anthropic"]}
      />,
    );
    const frame = lastFrame();
    expect(frame).toContain("openai");
    expect(frame).not.toContain("anthropic");
    expect(frame).not.toContain("Missing auth");
    expect(frame).not.toContain("zeno auth");
  });

  it("shows no providers message when none configured", () => {
    const { lastFrame } = render(
      <WelcomeBanner
        version="0.2.0"
        cwd="/tmp"
        providers={[{ slug: "openai", status: "missing" }]}
        missingProviders={["openai"]}
      />,
    );
    expect(lastFrame()).toContain("No providers configured");
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
