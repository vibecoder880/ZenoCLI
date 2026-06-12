import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadAllInstructions, getMergedInstructions, getInstructionsSummary } from "./neuro-md.js";

const testDir = path.join(os.tmpdir(), `.neuro-test-neuromd-${Date.now()}`);
const testProject = path.join(testDir, "project");
const testProjectClean = path.join(testDir, "clean-project");

beforeEach(() => {
  process.env.HOME = testDir;
  process.env.USERPROFILE = testDir;
  mkdirSync(testProject, { recursive: true });
  mkdirSync(testProjectClean, { recursive: true });
});

afterEach(() => {
  delete process.env.HOME;
  delete process.env.USERPROFILE;
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

describe("NEURO.md Loading", () => {
  it("returns empty when no NEURO.md exists", () => {
    const sources = loadAllInstructions(testProject);
    expect(sources).toHaveLength(0);
  });

  it("loads project NEURO.md from cwd", () => {
    writeFileSync(path.join(testProject, "NEURO.md"), "# Test Project\nUse TypeScript strict mode.");

    const sources = loadAllInstructions(testProject);
    expect(sources).toHaveLength(1);
    expect(sources[0].scope).toBe("project");
    expect(sources[0].content).toContain("TypeScript strict mode");
  });

  it("loads hierarchical NEURO.md files", () => {
    const subDir = path.join(testProject, "src");
    mkdirSync(subDir, { recursive: true });

    // Root NEURO.md
    writeFileSync(path.join(testProject, "NEURO.md"), "Root instructions");
    // Subdirectory NEURO.md
    writeFileSync(path.join(subDir, "NEURO.md"), "Src instructions");

    const sources = loadAllInstructions(subDir);
    expect(sources).toHaveLength(2);
    // Root should come first
    expect(sources[0].content).toBe("Root instructions");
    expect(sources[1].content).toBe("Src instructions");
  });

  it("loads scoped rules from .neuro/rules/", () => {
    const rulesDir = path.join(testProject, ".neuro", "rules");
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(path.join(rulesDir, "typescript.md"), "Always use strict types");
    writeFileSync(path.join(rulesDir, "testing.md"), "Write tests for every feature");

    const sources = loadAllInstructions(testProject);
    const rules = sources.filter((s) => s.scope === "rules");
    expect(rules).toHaveLength(2);
    // Rules are sorted by filename: testing.md, typescript.md
    expect(rules[0].content).toContain("Write tests");
    expect(rules[1].content).toContain("strict types");
  });

  it("merges all sources into single string", () => {
    writeFileSync(path.join(testProject, "NEURO.md"), "Project instructions");

    const merged = getMergedInstructions(testProject);
    expect(merged).toContain("Project instructions");
    expect(merged).toContain("Project: project");
  });

  it("returns undefined when nothing to load", () => {
    const merged = getMergedInstructions(testProjectClean);
    expect(merged).toBeUndefined();
  });

  it("provides summary for display", () => {
    writeFileSync(path.join(testProject, "NEURO.md"), "Hello world");

    const summary = getInstructionsSummary(testProject);
    expect(summary).toContain("project");
    expect(summary).toContain("NEURO.md");
  });
});
