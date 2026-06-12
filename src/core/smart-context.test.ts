import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { SmartContextLoader } from "./smart-context.js";

const testDir = path.join(os.tmpdir(), `.neuro-test-smart-${Date.now()}`);

beforeEach(() => {
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

describe("SmartContextLoader", () => {
  it("builds index of files", () => {
    writeFileSync(path.join(testDir, "index.ts"), "export {};");
    writeFileSync(path.join(testDir, "app.ts"), "export const app = 1;");

    const loader = new SmartContextLoader(testDir, []);
    const count = loader.buildIndex();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("respects ignore patterns", () => {
    mkdirSync(path.join(testDir, "node_modules"), { recursive: true });
    writeFileSync(path.join(testDir, "app.ts"), "code");
    writeFileSync(path.join(testDir, "node_modules", "lib.ts"), "code");

    const loader = new SmartContextLoader(testDir, ["node_modules"]);
    loader.buildIndex();

    const entries = loader.getStats();
    expect(entries.totalFiles).toBe(1);
  });

  it("marks files as seen", () => {
    const filePath = path.join(testDir, "test.ts");
    writeFileSync(filePath, "");

    const loader = new SmartContextLoader(testDir, []);
    loader.buildIndex();
    loader.markSeen(filePath);

    expect(loader.getSeenFiles()).toHaveLength(1);
  });

  it("tracks seen vs unseen files", () => {
    writeFileSync(path.join(testDir, "a.ts"), "");
    writeFileSync(path.join(testDir, "b.ts"), "");

    const loader = new SmartContextLoader(testDir, []);
    loader.buildIndex();
    loader.markSeen(path.join(testDir, "a.ts"));

    const unseen = loader.getUnseenFiles();
    expect(unseen.some((p) => p.includes("b.ts"))).toBe(true);
    expect(unseen.some((p) => p.includes("a.ts"))).toBe(false);
  });

  it("suggests files based on task keywords", () => {
    writeFileSync(path.join(testDir, "user-service.ts"), "");
    writeFileSync(path.join(testDir, "product-controller.ts"), "");
    writeFileSync(path.join(testDir, "README.md"), "");

    const loader = new SmartContextLoader(testDir, []);
    loader.buildIndex();

    const suggestions = loader.suggestForTask("fix the user service");
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]).toContain("user");
  });

  it("filters out stop words in suggestions", () => {
    writeFileSync(path.join(testDir, "real-file.ts"), "");

    const loader = new SmartContextLoader(testDir, []);
    loader.buildIndex();

    const suggestions = loader.suggestForTask("the and for");
    // Should match nothing (all stop words)
    expect(suggestions).toHaveLength(0);
  });

  it("infers tags from filenames", () => {
    writeFileSync(path.join(testDir, "app.test.ts"), "");
    writeFileSync(path.join(testDir, "config.json"), "");
    writeFileSync(path.join(testDir, "index.ts"), "");

    const loader = new SmartContextLoader(testDir, []);
    loader.buildIndex();

    const testEntry = loader.getEntry(path.join(testDir, "app.test.ts"));
    expect(testEntry?.tags).toContain("test");
  });

  it("infers config tag from .rc files", () => {
    writeFileSync(path.join(testDir, ".eslintrc.json"), "");

    const loader = new SmartContextLoader(testDir, []);
    loader.buildIndex();

    const entry = loader.getEntry(path.join(testDir, ".eslintrc.json"));
    expect(entry?.tags).toContain("config");
  });

  it("provides summary for display", () => {
    writeFileSync(path.join(testDir, "a.ts"), "x".repeat(1000));
    writeFileSync(path.join(testDir, "b.ts"), "y".repeat(500));

    const loader = new SmartContextLoader(testDir, []);
    loader.buildIndex();
    loader.markSeen(path.join(testDir, "a.ts"));

    const summary = loader.getSummary();
    expect(summary).toContain("Files:");
    expect(summary).toContain("KB total");
  });

  it("returns stats correctly", () => {
    writeFileSync(path.join(testDir, "a.ts"), "x".repeat(1000));
    writeFileSync(path.join(testDir, "b.ts"), "y".repeat(500));

    const loader = new SmartContextLoader(testDir, []);
    loader.buildIndex();
    loader.markSeen(path.join(testDir, "a.ts"));

    const stats = loader.getStats();
    expect(stats.totalFiles).toBe(2);
    expect(stats.seenFiles).toBe(1);
    expect(stats.totalSize).toBeGreaterThan(0);
    expect(stats.seenSize).toBeGreaterThan(0);
  });
});
