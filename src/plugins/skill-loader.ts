/**
 * Skills System — load and manage skill markdown files.
 *
 * Skills are markdown files with frontmatter that define:
 *   - name, description
 *   - trigger type (user-invocable or model-invocable)
 *   - context mode (inline or fork)
 *
 * Skills load descriptions at session start (low context cost).
 * Full content loads on demand (when invoked).
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { ensureAppDataDirectory } from "../storage/paths.js";

// ---- Types ----

export type SkillTrigger = "user-invocable" | "model-invocable";
export type SkillContext = "inline" | "fork";

export interface SkillDefinition {
  /** Unique skill name. */
  name: string;
  /** Short description (loaded at session start). */
  description: string;
  /** Trigger type. */
  trigger: SkillTrigger;
  /** Context mode. */
  context: SkillContext;
  /** Full skill content (loaded on demand). */
  content: string;
  /** Source file path. */
  filePath: string;
  /** Whether the full content has been loaded. */
  loaded: boolean;
  /** Namespace prefix (for plugin skills). */
  namespace?: string;
}

// ---- Parsing ----

interface Frontmatter {
  name?: string;
  description?: string;
  trigger?: string;
  context?: string;
}

/** Parse YAML-like frontmatter from markdown. */
function parseFrontmatter(raw: string): { frontmatter: Frontmatter; body: string } {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: raw };
  }

  const fm: Frontmatter = {};
  const lines = match[1].split("\n");
  for (const line of lines) {
    const kv = line.match(/^(\w+)\s*:\s*(.+)$/);
    if (kv) {
      const key = kv[1] as keyof Frontmatter;
      const value = kv[2].trim().replace(/^["']|["']$/g, "");
      (fm as Record<string, string>)[key] = value;
    }
  }

  return { frontmatter: fm, body: match[2] };
}

/** Load a skill from a file path. */
function loadSkillFromFile(filePath: string, namespace?: string): SkillDefinition | null {
  try {
    const raw = readFileSync(filePath, "utf8");
    const { frontmatter, body } = parseFrontmatter(raw);

    const name = frontmatter.name ?? path.basename(filePath, ".md");
    const description = frontmatter.description ?? "";
    const trigger = (frontmatter.trigger === "model-invocable" ? "model-invocable" : "user-invocable") as SkillTrigger;
    const context = (frontmatter.context === "fork" ? "fork" : "inline") as SkillContext;

    return {
      name,
      description,
      trigger,
      context,
      content: body.trim(),
      filePath,
      loaded: true,
      namespace,
    };
  } catch {
    return null;
  }
}

// ---- Skill Loader ----

export class SkillLoader {
  private skills = new Map<string, SkillDefinition>();

  /** Load all skills from a directory. */
  loadFromDirectory(dir: string, namespace?: string): number {
    if (!existsSync(dir)) return 0;

    let count = 0;
    const files = readdirSync(dir).filter((f) => f.endsWith(".md"));

    for (const file of files) {
      const filePath = path.join(dir, file);
      const skill = loadSkillFromFile(filePath, namespace);
      if (skill) {
        this.skills.set(skill.name, skill);
        count++;
      }
    }

    return count;
  }

  /** Get a skill by name. */
  getSkill(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  /** Get all loaded skills. */
  getAllSkills(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /** Get user-invocable skills (for slash commands). */
  getUserSkills(): SkillDefinition[] {
    return this.getAllSkills().filter((s) => s.trigger === "user-invocable");
  }

  /** Get skill descriptions for system prompt (low context cost). */
  getSkillDescriptions(): string {
    return this.getAllSkills()
      .map((s) => {
        const prefix = s.namespace ? `${s.namespace}:` : "/";
        return `${prefix}${s.name} — ${s.description}`;
      })
      .join("\n");
  }

  /** Get full skill content by name. */
  getSkillContent(name: string): string | undefined {
    const skill = this.skills.get(name);
    return skill?.content;
  }

  /** Load skills from standard directories. */
  loadStandardSkills(cwd: string): number {
    let total = 0;

    // Global skills: ~/.neurocli/skills/
    const globalDir = path.join(ensureAppDataDirectory(), "skills");
    total += this.loadFromDirectory(globalDir);

    // Project skills: .neuro/skills/
    const projectDir = path.join(cwd, ".neuro", "skills");
    total += this.loadFromDirectory(projectDir);

    return total;
  }
}
