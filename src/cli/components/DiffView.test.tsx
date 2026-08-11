import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { DiffView, parseUnifiedDiff } from "./DiffView.js";
import { MessageList, type ChatLine } from "./MessageList.js";

describe("parseUnifiedDiff", () => {
  const sample = [
    "diff --git a/src/a.ts b/src/a.ts",
    "index 111..222 100644",
    "--- a/src/a.ts",
    "+++ b/src/a.ts",
    "@@ -1,3 +1,4 @@",
    " const x = 1;",
    "-const y = 2;",
    "+const y = 3;",
    "+const z = 4;",
    "\\ No newline at end of file",
  ].join("\n");

  it("classifies add/del/ctx/hunk/meta lines", () => {
    const lines = parseUnifiedDiff(sample);
    expect(lines.filter((line) => line.type === "add").length).toBe(2);
    expect(lines.filter((line) => line.type === "del").length).toBe(1);
    expect(lines.filter((line) => line.type === "ctx").length).toBe(2);
    expect(lines.filter((line) => line.type === "hunk").length).toBe(1);
    expect(lines.filter((line) => line.type === "meta").length).toBe(4);
  });
});

describe("<DiffView />", () => {
  it("renders the diff lines", () => {
    const { lastFrame } = render(
      <DiffView content={"+added line\n-removed line\n@@ -1,2 +1,2 @@"} />,
    );
    const frame = lastFrame();
    expect(frame).toContain("+added line");
    expect(frame).toContain("-removed line");
    expect(frame).toContain("@@ -1,2 +1,2 @@");
  });
});

describe("<MessageList /> diff detection", () => {
  it("renders diff content through DiffView", () => {
    const messages: ChatLine[] = [
      { id: "1", role: "assistant", content: "Here is the change:\n@@ -1 +1 @@\n-foo\n+bar" },
    ];
    const { lastFrame } = render(<MessageList messages={messages} />);
    const frame = lastFrame();
    expect(frame).toContain("+bar");
    expect(frame).toContain("-foo");
  });

  it("renders plain content unchanged", () => {
    const messages: ChatLine[] = [
      { id: "1", role: "assistant", content: "No diff here, just text." },
    ];
    const { lastFrame } = render(<MessageList messages={messages} />);
    expect(lastFrame()).toContain("No diff here, just text.");
  });
});
