/**
 * Enhanced ZENO.md hierarchical loader.
 *
 * Loads instructions from multiple sources, merged in priority order:
 *   1. ~/.zenocli/ZENO.md  (global user instructions)
 *   2. .zeno/rules/*.md    (scoped rules by file pattern)
 *   3. ZENO.md files from root to cwd (project instructions)
 *
 * All sources are additive. Duplicates are deduplicated.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { getGlobalMemoryPath, getProjectRulesDirectory } from "../storage/paths.js";

export interface ZenoMdSource {
  /** Absolute path to the source file. */
  filePath: string;
  /** Scope of this source. */
  scope: "global" | "project" | "rules";
  /** The loaded content. */
  content: string;
}

/**
 * Load all ZENO.md instructions hierarchically.
 * Returns sources in priority order (global first, then root-to-cwd).
 */
export function loadAllInstructions(cwd = process.cwd()): ZenoMdSource[] {
  const sources: ZenoMdSource[] = [];

  // 1. Global user instructions
  const globalPath = getGlobalMemoryPath();
  // Note: global memory is at ~/.zenocli/MEMORY.md, global instructions at ~/.zenocli/ZENO.md
  const globalZenoMd = path.join(path.dirname(globalPath), "ZENO.md");
  if (existsSync(globalZenoMd)) {
    const content = readFileSync(globalZenoMd, "utf8").trim();
    if (content) {
      sources.push({ filePath: globalZenoMd, scope: "global", content });
    }
  }

  // 2. ZENO.md files from root to cwd (walk upward)
  const zenoFiles = findZenoMdFiles(cwd);
  for (const filePath of zenoFiles) {
    const content = readFileSync(filePath, "utf8").trim();
    if (content) {
      sources.push({ filePath, scope: "project", content });
    }
  }

  // 3. .zeno/rules/*.md (scoped rules)
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
 * Find ZENO.md files from root to cwd by walking upward.
 * Returns paths in root-first order (most general to most specific).
 */
function findZenoMdFiles(cwd: string): string[] {
  const files: string[] = [];
  let current = path.resolve(cwd);

  // Walk upward until we can't go further
  while (true) {
    const zenoPath = path.join(current, "ZENO.md");
    if (existsSync(zenoPath)) {
      files.unshift(zenoPath); // prepend so root is first
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
    return "No ZENO.md instructions loaded.";
  }

  return sources
    .map((s) => {
      const lines = s.content.split("\n").length;
      const size = Buffer.byteLength(s.content, "utf8");
      return `[${s.scope}] ${s.filePath} (${lines} lines, ${size} bytes)`;
    })
    .join("\n");
}
