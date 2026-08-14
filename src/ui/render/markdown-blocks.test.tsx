import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { MarkdownBlock, safeOsc8Url } from "./markdown-blocks.jsx";
import { parseMarkdown } from "./markdown-parse.js";
import { UiThemeProvider } from "../theme/provider.js";

const theme = {
  palette: {
    text: "white",
    muted: "gray",
    subtle: "grey",
    accent: "blue",
    success: "green",
    warning: "yellow",
    error: "red",
  },
  colorLevel: "truecolor" as const,
  noColor: false,
  nativeBackground: false,
};

function frameOf(block: string, opts?: { noColor?: boolean; osc8?: boolean }): string {
  const { noColor = false, osc8 = true } = opts ?? {};
  const { lastFrame } = render(
    <UiThemeProvider source={{ colorLevel: "truecolor", nativeBackground: false }} noColor={noColor}>
      <MarkdownBlock
        block={parseMarkdown(block)[0]}
        unicode
        osc8={osc8}
        theme={{ ...theme, noColor }}
      />
    </UiThemeProvider>,
  );
  return lastFrame();
}

describe("<MarkdownBlock />", () => {
  it("renders a heading line", () => {
    expect(frameOf("# Title")).toBe("Title");
  });

  it("renders a paragraph with bold and inline code", () => {
    const frame = frameOf("Use **bold** and `code` here");
    expect(frame).toContain("bold");
    expect(frame).toContain("code");
  });

  it("renders a bulleted list with markers", () => {
    const frame = frameOf("- one\n- two");
    expect(frame).toContain("· one");
    expect(frame).toContain("· two");
  });

  it("renders numbered list markers", () => {
    const frame = frameOf("1. first\n2. second");
    expect(frame).toContain("1. first");
    expect(frame).toContain("2. second");
  });

  it("renders code block lines indented", () => {
    const frame = frameOf("```ts\nconst x = 1;\n```");
    expect(frame).toContain("const x = 1;");
  });

  it("renders a table header and rows", () => {
    const frame = frameOf("| a | b |\n|---|---|\n| 1 | 2 |");
    expect(frame).toContain("a");
    expect(frame).toContain("1");
  });

  it("renders links with URL when OSC 8 is unsupported", () => {
    const frame = frameOf("[docs](https://example.com)", { osc8: false });
    expect(frame).toContain("docs (https://example.com)");
  });

  it("renders diff lines with + and - prefix intact", () => {
    const frame = frameOf("@@ -1 +1 @@\n-old\n+new");
    expect(frame).toContain("-old");
    expect(frame).toContain("+new");
  });

  it("falls back to plain text when OSC 8 renders and URL is unsafe", () => {
    // A control character in the URL must not be embedded in the escape
    // sequence; it renders as plain `text (url)` instead.
    const frame = frameOf("[x](https://example.com/a\bb)");
    expect(frame).toContain("x (https://example.com");
    expect(frame).not.toContain("]8;;");
  });

  describe("safeOsc8Url", () => {
    it("accepts http/https/mailto links", () => {
      expect(safeOsc8Url("https://example.com")).toBe("https://example.com");
      expect(safeOsc8Url("http://a.b")).toBe("http://a.b");
      expect(safeOsc8Url("mailto:a@b.c")).toBe("mailto:a@b.c");
    });

    it("rejects non-web schemes", () => {
      expect(safeOsc8Url("file:///etc/passwd")).toBeNull();
      expect(safeOsc8Url("data:text/html,x")).toBeNull();
      expect(safeOsc8Url("javascript:alert(1)")).toBeNull();
    });

    it("rejects control characters", () => {
      expect(safeOsc8Url("https://example.com/ab")).toBeNull();
      expect(safeOsc8Url("https://example.com/a\tb")).toBeNull();
    });

    it("rejects empty and oversized URLs", () => {
      expect(safeOsc8Url("")).toBeNull();
      expect(safeOsc8Url(`https://example.com/${"a".repeat(2001)}`)).toBeNull();
    });
  });

  it("renders without color under NO_COLOR", () => {
    const { lastFrame } = render(
      <UiThemeProvider source={{ colorLevel: "truecolor", nativeBackground: false }} noColor>
        <MarkdownBlock
          block={parseMarkdown("# No color")[0]}
          unicode
          osc8
          theme={{ ...theme, noColor: true }}
        />
      </UiThemeProvider>,
    );
    expect(lastFrame()).toBe("No color");
  });
});