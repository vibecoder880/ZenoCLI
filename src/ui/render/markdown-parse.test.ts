import { describe, expect, it } from "vitest";
import { isUnifiedDiff, parseInline, parseMarkdown } from "./markdown-parse.js";

describe("parseInline", () => {
  it("returns plain text unchanged", () => {
    expect(parseInline("hello world")).toEqual([{ type: "text", value: "hello world" }]);
  });

  it("parses bold, italic, code, and link spans", () => {
    const nodes = parseInline("**b** *i* `c` and [link](https://x.dev)");
    expect(nodes).toEqual([
      { type: "bold", children: [{ type: "text", value: "b" }] },
      { type: "text", value: " " },
      { type: "italic", children: [{ type: "text", value: "i" }] },
      { type: "text", value: " " },
      { type: "code", value: "c" },
      { type: "text", value: " and " },
      { type: "link", text: "link", url: "https://x.dev" },
    ]);
  });

  it("keeps text between spans intact", () => {
    const nodes = parseInline("a **b** c");
    expect(nodes[0]).toEqual({ type: "text", value: "a " });
    expect(nodes[2]).toEqual({ type: "text", value: " c" });
  });
});

describe("isUnifiedDiff", () => {
  it("detects a unified diff with hunk headers", () => {
    expect(isUnifiedDiff("@@ -1,4 +1,4 @@\n-old\n+new")).toBe(true);
  });

  it("returns false for plain prose", () => {
    expect(isUnifiedDiff("just some text")).toBe(false);
  });
});

describe("parseMarkdown", () => {
  it("parses headings with levels", () => {
    const blocks = parseMarkdown("# One\n\n### Three");
    expect(blocks).toEqual([
      { type: "heading", level: 1, children: [{ type: "text", value: "One" }] },
      { type: "heading", level: 3, children: [{ type: "text", value: "Three" }] },
    ]);
  });

  it("parses fenced code blocks with language", () => {
    const blocks = parseMarkdown("```ts\nconst a = 1;\n```");
    expect(blocks).toEqual([
      { type: "code", language: "ts", value: "const a = 1;" },
    ]);
  });

  it("parses bullet and ordered lists", () => {
    const blocks = parseMarkdown("- one\n- two\n\n1. first\n2. second");
    expect(blocks[0]).toMatchObject({
      type: "list",
      ordered: false,
      items: [
        { children: [{ type: "text", value: "one" }] },
        { children: [{ type: "text", value: "two" }] },
      ],
    });
    expect(blocks[1]).toMatchObject({ type: "list", ordered: true });
  });

  it("parses blockquotes and horizontal rules", () => {
    const blocks = parseMarkdown("> quoted text\n\n---");
    expect(blocks).toEqual([
      { type: "quote", children: [{ type: "text", value: "quoted text" }] },
      { type: "rule" },
    ]);
  });

  it("parses tables with header and rows", () => {
    const blocks = parseMarkdown("| a | b |\n|---|---|\n| 1 | 2 |");
    expect(blocks).toEqual([
      { type: "table", header: ["a", "b"], rows: [["1", "2"]] },
    ]);
  });

  it("treats a unified diff as a diff block", () => {
    const blocks = parseMarkdown("@@ -1 +1 @@\n-old\n+new");
    expect(blocks).toEqual([{ type: "diff", value: "@@ -1 +1 @@\n-old\n+new" }]);
  });

  it("parses indented code blocks", () => {
    const blocks = parseMarkdown("    const x = 1;");
    expect(blocks).toEqual([{ type: "code", value: "const x = 1;" }]);
  });

  it("joins multi-line paragraphs", () => {
    const blocks = parseMarkdown("first line\nsecond line");
    expect(blocks).toEqual([
      { type: "paragraph", children: [{ type: "text", value: "first line second line" }] },
    ]);
  });
});
