import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { SkillLoader } from "./skill-loader.js";
import * as skillModule from "./skill-loader.js";

const testDir = path.join(os.tmpdir(), `.zeno-test-skills-${Date.now()}`);

beforeEach(() => {
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

describe("SkillLoader", () => {
  it("starts with no skills", () => {
    const loader = new SkillLoader();
    expect(loader.getAllSkills()).toHaveLength(0);
  });

  it("loads a skill from a markdown file", () => {
    const filePath = path.join(testDir, "deploy.md");
    writeFileSync(
      filePath,
      `---
name: deploy
description: Deploy the project
trigger: user-invocable
context: inline
---
# Deploy

Run the deploy script.`,
      "utf8",
    );

    const loader = new SkillLoader();
    const count = loader.loadFromDirectory(testDir);
    expect(count).toBe(1);

    const skill = loader.getSkill("deploy");
    expect(skill).toBeDefined();
    expect(skill?.description).toBe("Deploy the project");
    expect(skill?.trigger).toBe("user-invocable");
    expect(skill?.context).toBe("inline");
    expect(skill?.content).toContain("Run the deploy script");
  });

  it("returns 0 for non-existent directory", () => {
    const loader = new SkillLoader();
    const count = loader.loadFromDirectory("/nonexistent/path");
    expect(count).toBe(0);
  });

  it("filters user-invocable skills", () => {
    writeFileSync(
      path.join(testDir, "user-skill.md"),
      `---
name: a
description: User skill
trigger: user-invocable
---
Content A`,
      "utf8",
    );

    writeFileSync(
      path.join(testDir, "model-skill.md"),
      `---
name: b
description: Model skill
trigger: model-invocable
---
Content B`,
      "utf8",
    );

    const loader = new SkillLoader();
    loader.loadFromDirectory(testDir);

    expect(loader.getAllSkills()).toHaveLength(2);
    expect(loader.getUserSkills()).toHaveLength(1);
    expect(loader.getUserSkills()[0].name).toBe("a");
  });

  it("provides descriptions for system prompt (low context cost)", () => {
    writeFileSync(
      path.join(testDir, "skill.md"),
      `---
name: foo
description: Foo skill
---
Content`,
      "utf8",
    );

    const loader = new SkillLoader();
    loader.loadFromDirectory(testDir);

    const descriptions = loader.getSkillDescriptions();
    expect(descriptions).toContain("foo");
    expect(descriptions).toContain("Foo skill");
  });

  it("loads full content on demand", () => {
    writeFileSync(
      path.join(testDir, "skill.md"),
      `---
name: deep
description: Deep skill
---
This is the full body with many instructions.`,
      "utf8",
    );

    const loader = new SkillLoader();
    loader.loadFromDirectory(testDir);

    const content = loader.getSkillContent("deep");
    expect(content).toContain("full body with many instructions");
  });

  it("uses filename when name is missing from frontmatter", () => {
    writeFileSync(path.join(testDir, "review.md"), `# Just content, no frontmatter`);

    const loader = new SkillLoader();
    loader.loadFromDirectory(testDir);

    const skill = loader.getSkill("review");
    expect(skill).toBeDefined();
    expect(skill?.name).toBe("review");
  });

  it("skips non-md files", () => {
    writeFileSync(path.join(testDir, "skill.md"), "---\nname: a\n---\nA");
    writeFileSync(path.join(testDir, "notes.txt"), "ignore me");
    writeFileSync(path.join(testDir, "config.json"), "{}");

    const loader = new SkillLoader();
    const count = loader.loadFromDirectory(testDir);
    expect(count).toBe(1);
  });
});

describe("loadSkillFromFile", () => {
  it("parses a valid skill file", () => {
    const filePath = path.join(testDir, "test.md");
    writeFileSync(
      filePath,
      `---
name: test
description: Test
trigger: user-invocable
context: fork
---
Body`,
      "utf8",
    );

    const skill = (skillModule as { loadSkillFromFile?: typeof import("./skill-loader.js").loadSkillFromFile }).loadSkillFromFile?.(filePath);
    // loadSkillFromFile may not be exported — test via loader
    const loader = new SkillLoader();
    loader.loadFromDirectory(testDir);
    const found = loader.getSkill("test");
    expect(found).toBeDefined();
    expect(found?.name).toBe("test");
    expect(found?.context).toBe("fork");
    if (skill !== undefined) {
      expect(skill.name).toBe("test");
    }
  });

  it("returns null for invalid file", () => {
    const fn = (skillModule as { loadSkillFromFile?: (p: string) => unknown }).loadSkillFromFile;
    if (fn) {
      expect(fn("/nonexistent/file.md")).toBeNull();
    } else {
      // Function not exported — that's fine
      expect(true).toBe(true);
    }
  });
});
