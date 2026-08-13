import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { DiffBlock } from "./DiffBlock.js";

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

const SAMPLE_DIFF = `diff --git a/src/auth.ts b/src/auth.ts
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,7 +10,7 @@ export function verify(token: string): boolean {
   if (!token) {
     return false;
   }
-  if (!token) {
+  if (!token?.trim()) {
     return false;
   }
 }
diff --git a/src/utils.ts b/src/utils.ts
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,3 +1,4 @@
+import { verify } from "./auth.js";
+
 export function helpers() {
   return true;
}`;

describe("DiffBlock", () => {
  it("renders summary header", () => {
    const { lastFrame } = render(
      <DiffBlock diffText={SAMPLE_DIFF} unicode={true} />
    );
    expect(lastFrame()).toContain("2 files changed");
  });

  it("renders file paths", () => {
    const { lastFrame } = render(
      <DiffBlock diffText={SAMPLE_DIFF} unicode={true} />
    );
    expect(lastFrame()).toContain("src/auth.ts");
    expect(lastFrame()).toContain("src/utils.ts");
  });

  it("renders added/removed counts per file", () => {
    const { lastFrame } = render(
      <DiffBlock diffText={SAMPLE_DIFF} unicode={true} />
    );
    expect(lastFrame()).toContain("+1");
    expect(lastFrame()).toContain("−1");
  });

  it("returns null for empty diff", () => {
    const { lastFrame } = render(
      <DiffBlock diffText="no diff here" unicode={true} />
    );
    expect(lastFrame()).toBe("");
  });

  it("highlights focused file", () => {
    const { lastFrame } = render(
      <DiffBlock diffText={SAMPLE_DIFF} unicode={true} focusedFileIndex={0} />
    );
    // Focused file has ● indicator
    expect(lastFrame()).toContain("● src/auth.ts");
  });

  it("renders hunk headers", () => {
    const { lastFrame } = render(
      <DiffBlock diffText={SAMPLE_DIFF} unicode={true} />
    );
    expect(lastFrame()).toContain("@@");
  });
});
