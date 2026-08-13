import { describe, it, expect } from "vitest";
import { parseDiff, diffSummary } from "./diff-parse.js";

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

describe("parseDiff", () => {
  it("parses multi-file diff", () => {
    const stats = parseDiff(SAMPLE_DIFF);
    expect(stats.files).toHaveLength(2);
    expect(stats.files[0].path).toBe("src/auth.ts");
    expect(stats.files[1].path).toBe("src/utils.ts");
  });

  it("counts added and removed lines", () => {
    const stats = parseDiff(SAMPLE_DIFF);
    expect(stats.files[0].added).toBe(1);
    expect(stats.files[0].removed).toBe(1);
    expect(stats.files[1].added).toBe(2);
    expect(stats.files[1].removed).toBe(0);
    expect(stats.totalAdded).toBe(3);
    expect(stats.totalRemoved).toBe(1);
  });

  it("parses hunks with headers", () => {
    const stats = parseDiff(SAMPLE_DIFF);
    expect(stats.files[0].hunks).toHaveLength(1);
    expect(stats.files[0].hunks[0].header).toContain("@@");
  });

  it("returns empty for no diff", () => {
    const stats = parseDiff("no diff here");
    expect(stats.files).toHaveLength(0);
    expect(stats.totalAdded).toBe(0);
    expect(stats.totalRemoved).toBe(0);
  });

  it("handles single-file diff", () => {
    const diff = `diff --git a/foo.ts b/foo.ts
--- a/foo.ts
+++ b/foo.ts
@@ -1 +1 @@
-old
+new`;
    const stats = parseDiff(diff);
    expect(stats.files).toHaveLength(1);
    expect(stats.files[0].path).toBe("foo.ts");
    expect(stats.files[0].added).toBe(1);
    expect(stats.files[0].removed).toBe(1);
  });
});

describe("diffSummary", () => {
  it("returns correct summary for multi-file", () => {
    const stats = parseDiff(SAMPLE_DIFF);
    expect(diffSummary(stats)).toBe("2 files changed · +3 −1");
  });

  it("returns singular for one file", () => {
    const diff = `diff --git a/x.ts b/x.ts
--- a/x.ts
+++ b/x.ts
@@ -1 +1 @@
+new`;
    const stats = parseDiff(diff);
    expect(diffSummary(stats)).toBe("1 file changed · +1 −0");
  });

  it("returns No changes for empty", () => {
    const stats = parseDiff("nothing");
    expect(diffSummary(stats)).toBe("No changes");
  });
});
