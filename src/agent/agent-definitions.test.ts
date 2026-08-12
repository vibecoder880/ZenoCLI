import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { AgentDefinitionLoader } from "./agent-definitions.js";

const testDir = path.join(os.tmpdir(), `.zeno-test-agents-${Date.now()}`);

beforeEach(() => {
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

describe("AgentDefinitionLoader", () => {
  it("loads agent from markdown file", () => {
    writeFileSync(
      path.join(testDir, "reviewer.md"),
      `---
name: reviewer
description: Reviews code
tools: [read_file, glob]
model: anthropic/claude-sonnet-5
---
You are a code reviewer.`,
      "utf8",
    );

    const loader = new AgentDefinitionLoader();
    const count = loader.loadFromDirectory(testDir);
    expect(count).toBe(1);

    const agent = loader.getAgent("reviewer");
    expect(agent).toBeDefined();
    expect(agent?.description).toBe("Reviews code");
    expect(agent?.tools).toEqual(["read_file", "glob"]);
    expect(agent?.model).toBe("anthropic/claude-sonnet-5");
    expect(agent?.systemPrompt).toContain("code reviewer");
  });

  it("parses tools list", () => {
    writeFileSync(
      path.join(testDir, "agent.md"),
      `---
name: agent
tools: read_file, list_dir, glob
---
Content`,
      "utf8",
    );

    const loader = new AgentDefinitionLoader();
    loader.loadFromDirectory(testDir);

    const agent = loader.getAgent("agent");
    expect(agent?.tools).toEqual(["read_file", "list_dir", "glob"]);
  });

  it("uses filename when name is missing", () => {
    writeFileSync(
      path.join(testDir, "custom.md"),
      `# Just content, no frontmatter`,
      "utf8",
    );

    const loader = new AgentDefinitionLoader();
    loader.loadFromDirectory(testDir);

    const agent = loader.getAgent("custom");
    expect(agent).toBeDefined();
  });

  it("returns 0 for non-existent directory", () => {
    const loader = new AgentDefinitionLoader();
    expect(loader.loadFromDirectory("/nonexistent")).toBe(0);
  });

  it("skips non-md files", () => {
    writeFileSync(path.join(testDir, "agent.md"), "---\nname: a\n---\nA");
    writeFileSync(path.join(testDir, "notes.txt"), "ignore");

    const loader = new AgentDefinitionLoader();
    expect(loader.loadFromDirectory(testDir)).toBe(1);
  });

  it("provides descriptions for system prompt", () => {
    writeFileSync(
      path.join(testDir, "a.md"),
      `---
name: alpha
description: First agent
---
A`,
      "utf8",
    );
    writeFileSync(
      path.join(testDir, "b.md"),
      `---
name: beta
description: Second agent
---
B`,
      "utf8",
    );

    const loader = new AgentDefinitionLoader();
    loader.loadFromDirectory(testDir);

    const descriptions = loader.getAgentDescriptions();
    expect(descriptions).toContain("alpha");
    expect(descriptions).toContain("beta");
  });

  it("clears all loaded agents", () => {
    writeFileSync(path.join(testDir, "a.md"), "---\nname: a\n---\nA");

    const loader = new AgentDefinitionLoader();
    loader.loadFromDirectory(testDir);
    expect(loader.getAllAgents()).toHaveLength(1);

    loader.clear();
    expect(loader.getAllAgents()).toHaveLength(0);
  });
});
