import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadMemory, saveMemory, saveCorrection, savePreference, readFullMemory, getMemorySummary, writeProjectMemory } from "./memory.js";

const testDir = path.join(os.tmpdir(), `.neuro-test-memory-${Date.now()}`);

beforeEach(() => {
  process.env.HOME = testDir;
  process.env.USERPROFILE = testDir;
});

afterEach(() => {
  delete process.env.HOME;
  delete process.env.USERPROFILE;
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

describe("Memory", () => {
  it("returns empty when no memory exists", () => {
    const content = loadMemory("/nonexistent");
    expect(content).toBe("");
  });

  it("saves and loads memory", () => {
    saveMemory("Test memory entry", "/tmp");

    const content = loadMemory("/tmp");
    expect(content).toContain("Test memory entry");
  });

  it("saves a correction", () => {
    saveCorrection("I said wrong thing", "Actually correct", "/tmp");

    const content = loadMemory("/tmp");
    expect(content).toContain("Correction");
    expect(content).toContain("wrong thing");
  });

  it("saves a preference", () => {
    savePreference("Use tabs not spaces", "/tmp");

    const content = loadMemory("/tmp");
    expect(content).toContain("Preference");
    expect(content).toContain("tabs");
  });

  it("truncates memory to limits", () => {
    // Save a very large memory
    const largeContent = "x".repeat(50_000);
    saveMemory(largeContent, "/tmp");

    const loaded = loadMemory("/tmp");
    expect(loaded.length).toBeLessThan(50_000);
  });

  it("reads full memory for display", () => {
    saveMemory("Project note", "/tmp");

    const full = readFullMemory("/tmp");
    expect(full.project).toContain("Project note");
  });

  it("returns summary", () => {
    saveMemory("Test", "/tmp");

    const summary = getMemorySummary("/tmp");
    expect(summary).toContain("Project memory");
  });

  it("overwrites project memory", () => {
    saveMemory("Old content", "/tmp");
    writeProjectMemory("New content", "/tmp");

    const full = readFullMemory("/tmp");
    expect(full.project).toContain("New content");
    expect(full.project).not.toContain("Old content");
  });

  it("reports no memories when empty", () => {
    const summary = getMemorySummary("/nonexistent");
    expect(summary).toContain("No memories");
  });
});
