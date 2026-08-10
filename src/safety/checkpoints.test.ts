import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, writeFileSync, rmSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { CheckpointManager } from "./checkpoints.js";

const testDir = path.join(os.tmpdir(), `.zeno-test-checkpoints-${Date.now()}`);

beforeEach(() => {
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

describe("CheckpointManager", () => {
  it("starts with no checkpoints", () => {
    const cm = new CheckpointManager();
    expect(cm.count).toBe(0);
  });

  it("creates a snapshot for an existing file", () => {
    const filePath = path.join(testDir, "test.txt");
    writeFileSync(filePath, "original content", "utf8");

    const cm = new CheckpointManager();
    cm.snapshot(filePath, "write_file");

    expect(cm.count).toBe(1);
    const cps = cm.listCheckpoints();
    expect(cps[0].previousContent).toBe("original content");
    expect(cps[0].filePath).toBe(filePath);
    expect(cps[0].toolName).toBe("write_file");
  });

  it("creates a snapshot for a new file (null content)", () => {
    const filePath = path.join(testDir, "new.txt");

    const cm = new CheckpointManager();
    cm.snapshot(filePath, "write_file");

    expect(cm.count).toBe(1);
    const cps = cm.listCheckpoints();
    expect(cps[0].previousContent).toBeNull();
  });

  it("undoes a file edit by restoring previous content", () => {
    const filePath = path.join(testDir, "test.txt");
    writeFileSync(filePath, "original", "utf8");

    const cm = new CheckpointManager();
    cm.snapshot(filePath, "write_file");
    writeFileSync(filePath, "modified", "utf8");

    const result = cm.undo();
    expect(result).not.toBeNull();
    expect(result?.checkpoint.toolName).toBe("write_file");

    const restored = readFileSync(filePath, "utf8");
    expect(restored).toBe("original");
  });

  it("undoes most recent checkpoint first (LIFO)", () => {
    const filePath = path.join(testDir, "test.txt");
    writeFileSync(filePath, "v1", "utf8");

    const cm = new CheckpointManager();
    cm.snapshot(filePath, "write_file");
    writeFileSync(filePath, "v2", "utf8");
    cm.snapshot(filePath, "edit_file");
    writeFileSync(filePath, "v3", "utf8");

    // Undo v3 → restore v2
    cm.undo();
    expect(readFileSync(filePath, "utf8")).toBe("v2");

    // Undo v2 → restore v1
    cm.undo();
    expect(readFileSync(filePath, "utf8")).toBe("v1");

    expect(cm.count).toBe(0);
  });

  it("returns null when no checkpoints to undo", () => {
    const cm = new CheckpointManager();
    expect(cm.undo()).toBeNull();
  });

  it("limits checkpoints to MAX_CHECKPOINTS", () => {
    const filePath = path.join(testDir, "test.txt");
    writeFileSync(filePath, "v0", "utf8");

    const cm = new CheckpointManager();

    // Create 150 snapshots (more than MAX_CHECKPOINTS=100)
    for (let i = 0; i < 150; i++) {
      cm.snapshot(filePath, "write_file");
    }

    // Should be capped at 100
    expect(cm.count).toBeLessThanOrEqual(100);
  });

  it("clears all checkpoints", () => {
    const filePath = path.join(testDir, "test.txt");
    writeFileSync(filePath, "v1", "utf8");

    const cm = new CheckpointManager();
    cm.snapshot(filePath, "write_file");
    cm.snapshot(filePath, "edit_file");
    expect(cm.count).toBe(2);

    cm.clear();
    expect(cm.count).toBe(0);
  });

  it("provides a summary for display", () => {
    const filePath = path.join(testDir, "test.txt");
    writeFileSync(filePath, "v1", "utf8");

    const cm = new CheckpointManager();
    cm.snapshot(filePath, "write_file");

    const summary = cm.getSummary();
    expect(summary).toContain("Checkpoints: 1");
    expect(summary).toContain("write_file");
  });
});
