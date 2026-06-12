/**
 * Enhanced NEURO.md hierarchical loader.
 *
 * Loads instructions from multiple sources, merged in priority order:
 *   1. ~/.neurocli/NEURO.md  (global user instructions)
 *   2. .neuro/rules/*.md     (scoped rules by file pattern)
 *   3. NEURO.md files from root to cwd (project instructions)
 *
 * All sources are additive. Duplicates are deduplicated.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { getGlobalMemoryPath, getProjectRulesDirectory } from "../storage/paths.js";

export interface NeuroMdSource {
  /** Absolute path to the source file. */
  filePath: string;
  /** Scope of this source. */
  scope: "global" | "project" | "rules";
  /** The loaded content. */
  content: string;
}

/**
 * Load all NEURO.md instructions hierarchically.
 * Returns sources in priority order (global first, then root-to-cwd).
 */
export function loadAllInstructions(cwd = process.cwd()): NeuroMdSource[] {
  const sources: NeuroMdSource[] = [];

  // 1. Global user instructions
  const globalPath = getGlobalMemoryPath();
  // Note: global memory is at ~/.neurocli/MEMORY.md, global instructions at ~/.neurocli/NEURO.md
  const globalNeuroMd = path.join(path.dirname(globalPath), "NEURO.md");
  if (existsSync(globalNeuroMd)) {
    const content = readFileSync(globalNeuroMd, "utf8").trim();
    if (content) {
      sources.push({ filePath: globalNeuroMd, scope: "global", content });
    }
  }

  // 2. NEURO.md files from root to cwd (walk upward)
  const neuroFiles = findNeuroMdFiles(cwd);
  for (const filePath of neuroFiles) {
    const content = readFileSync(filePath, "utf8").trim();
    if (content) {
      sources.push({ filePath, scope: "project", content });
    }
  }

  // 3. .neuro/rules/*.md (scoped rules)
  const rulesDir = getProjectRulesDirectory(cwd);
  if (existsSync(rulesDir)) {
    const ruleFiles = readdirSync(rulesDir)
      .filter((f) => f.endsWith(".md"))
      .sort();

    for (const file of ruleFiles) {
      const filePath = path.join(rulesDir, file);
      const content = readFileSync(filePath, "utf8").trim();
      if (content) {
        sources.push({ filePath, scope: "rules", content });
      }
    }
  }

  return sources;
}

/**
 * Get the merged instructions as a single string, ready for system prompt.
 */
export function getMergedInstructions(cwd = process.cwd()): string | undefined {
  const sources = loadAllInstructions(cwd);
  if (sources.length === 0) return undefined;

  const sections: string[] = [];

  for (const source of sources) {
    const label = source.scope === "global"
      ? "Global user instructions"
      : source.scope === "rules"
        ? `Rule: ${path.basename(source.filePath)}`
        : `Project: ${path.basename(path.dirname(source.filePath))}`;

    sections.push(`### ${label}\n${source.content}`);
  }

  return sections.join("\n\n");
}

/**
 * Find NEURO.md files from root to cwd by walking upward.
 * Returns paths in root-first order (most general to most specific).
 */
function findNeuroMdFiles(cwd: string): string[] {
  const files: string[] = [];
  let current = path.resolve(cwd);

  // Walk upward until we can't go further
  while (true) {
    const neuroPath = path.join(current, "NEURO.md");
    if (existsSync(neuroPath)) {
      files.unshift(neuroPath); // prepend so root is first
    }

    const parent = path.dirname(current);
    if (parent === current) break; // reached root
    current = parent;
  }

  return files;
}

/**
 * Get a summary of loaded instructions for /context command.
 */
export function getInstructionsSummary(cwd = process.cwd()): string {
  const sources = loadAllInstructions(cwd);

  if (sources.length === 0) {
    return "No NEURO.md instructions loaded.";
  }

  return sources
    .map((s) => {
      const lines = s.content.split("\n").length;
      const size = Buffer.byteLength(s.content, "utf8");
      return `[${s.scope}] ${s.filePath} (${lines} lines, ${size} bytes)`;
    })
    .join("\n");
}
