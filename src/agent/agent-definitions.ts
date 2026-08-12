/**
 * Agent Definitions Loader — load custom agent types từ markdown files.
 *
 * Format:
 *   ---
 *   name: agent-name
 *   description: ...
 *   tools: [read_file, glob, ...]
 *   model: anthropic/claude-sonnet-5
 *   ---
 *   # System prompt...
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export interface AgentDefinition {
  /** Unique agent name. */
  name: string;
  /** Short description. */
  description: string;
  /** Tools available to this agent. */
  tools: string[];
  /** Model to use (provider/model format). */
  model?: string;
  /** System prompt / instructions. */
  systemPrompt: string;
  /** Source file path. */
  filePath: string;
}

// ---- Parsing ----

interface AgentFrontmatter {
  name?: string;
  description?: string;
  tools?: string;
  model?: string;
}

function parseAgentFrontmatter(raw: string): { frontmatter: AgentFrontmatter; body: string } {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: raw };
  }

  const fm: AgentFrontmatter = {};
  const lines = match[1].split("\n");
  for (const line of lines) {
    const kv = line.match(/^(\w+)\s*:\s*(.+)$/);
    if (kv) {
      const key = kv[1] as keyof AgentFrontmatter;
      let value = kv[2].trim().replace(/^["']|["']$/g, "");
      // Handle YAML array format: [a, b, c]
      if (value.startsWith("[") && value.endsWith("]")) {
        value = value.slice(1, -1);
      }
      (fm as Record<string, string>)[key] = value;
    }
  }

  return { frontmatter: fm, body: match[2] };
}

function parseToolsList(toolsStr: string): string[] {
  if (!toolsStr) return [];
  // Handle [a, b, c] format
  if (toolsStr.startsWith("[") && toolsStr.endsWith("]")) {
    return toolsStr.slice(1, -1).split(",").map((t) => t.trim()).filter(Boolean);
  }
  // Handle comma-separated
  return toolsStr.split(",").map((t) => t.trim()).filter(Boolean);
}

function loadAgentFromFile(filePath: string): AgentDefinition | null {
  try {
    const raw = readFileSync(filePath, "utf8");
    const { frontmatter, body } = parseAgentFrontmatter(raw);

    return {
      name: frontmatter.name ?? path.basename(filePath, ".md"),
      description: frontmatter.description ?? "",
      tools: parseToolsList(frontmatter.tools ?? ""),
      model: frontmatter.model,
      systemPrompt: body.trim(),
      filePath,
    };
  } catch {
    return null;
  }
}

// ---- Loader ----

export class AgentDefinitionLoader {
  private agents = new Map<string, AgentDefinition>();

  /** Load tất cả agents từ một directory. */
  loadFromDirectory(dir: string): number {
    if (!existsSync(dir)) return 0;

    let count = 0;
    const files = readdirSync(dir).filter((f) => f.endsWith(".md"));

    for (const file of files) {
      const filePath = path.join(dir, file);
      const agent = loadAgentFromFile(filePath);
      if (agent) {
        this.agents.set(agent.name, agent);
        count++;
      }
    }

    return count;
  }

  /** Lấy agent theo name. */
  getAgent(name: string): AgentDefinition | undefined {
    return this.agents.get(name);
  }

  /** Lấy tất cả agents. */
  getAllAgents(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  /** Lấy descriptions cho system prompt. */
  getAgentDescriptions(): string {
    return this.getAllAgents()
      .map((a) => `- ${a.name}: ${a.description}`)
      .join("\n");
  }

  /** Load built-in agents từ src/agents/. */
  loadBuiltinAgents(): number {
    // Built-in agents are bundled in src/agents/
    // Use import.meta.url to resolve path
    try {
      const builtinDir = new URL("../../agents/", import.meta.url).pathname;
      return this.loadFromDirectory(builtinDir);
    } catch {
      return 0;
    }
  }

  /** Clear all loaded agents. */
  clear(): void {
    this.agents.clear();
  }
}
