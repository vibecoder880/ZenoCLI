/**
 * Cross-session memory system.
 *
 * Reads and writes MEMORY.md files that persist across sessions.
 * Two scopes: global (~/.zenocli/MEMORY.md) and project-scoped.
 * Loads first 200 lines / 25KB at session start.
 */

import { existsSync, readFileSync, appendFileSync, writeFileSync, mkdirSync } from "node:fs";
import { getMemoryPath, getGlobalMemoryPath, getMemoryDirectory } from "../storage/paths.js";

const MAX_LINES = 200;
const MAX_BYTES = 25 * 1024; // 25KB

export interface MemoryEntry {
  /** The memory content (markdown text). */
  content: string;
  /** When this was saved. */
  savedAt: string;
}

// ---- Reading ----

/** Read memory content, respecting line and size limits. */
export function loadMemory(cwd: string): string {
  const sources: string[] = [];

  // Global memory first
  const globalPath = getGlobalMemoryPath();
  if (existsSync(globalPath)) {
    const content = readFileSync(globalPath, "utf8").trim();
    if (content) {
      sources.push(`# Global Memory\n${content}`);
    }
  }

  // Project-scoped memory
  const projectPath = getMemoryPath(cwd);
  if (existsSync(projectPath)) {
    const content = readFileSync(projectPath, "utf8").trim();
    if (content) {
      sources.push(`# Project Memory\n${content}`);
    }
  }

  if (sources.length === 0) {
    return "";
  }

  const combined = sources.join("\n\n");
  return truncateMemory(combined);
}

/** Truncate memory to fit within limits. */
function truncateMemory(content: string): string {
  // Size limit first
  if (Buffer.byteLength(content, "utf8") > MAX_BYTES) {
    content = content.slice(0, MAX_BYTES);
  }

  // Then line limit
  const lines = content.split("\n");
  if (lines.length > MAX_LINES) {
    content = lines.slice(0, MAX_LINES).join("\n");
  }

  return content;
}

// ---- Writing ----

/** Append a memory entry to the project-scoped MEMORY.md. */
export function saveMemory(content: string, cwd: string): void {
  const memoryDir = getMemoryDirectory(cwd);
  mkdirSync(memoryDir, { recursive: true });

  const memoryPath = getMemoryPath(cwd);
  const timestamp = new Date().toISOString();
  const entry = `\n## ${timestamp}\n${content}\n`;

  if (!existsSync(memoryPath)) {
    writeFileSync(memoryPath, `# Auto Memory\n${entry}`, "utf8");
  } else {
    appendFileSync(memoryPath, entry, "utf8");
  }
}

/** Save a correction (when user corrects the agent). */
export function saveCorrection(original: string, correction: string, cwd: string): void {
  const content = `- **Correction**: I said "${original.slice(0, 100)}" but the user corrected to "${correction.slice(0, 100)}"`;
  saveMemory(content, cwd);
}

/** Save a user preference. */
export function savePreference(preference: string, cwd: string): void {
  const content = `- **Preference**: ${preference}`;
  saveMemory(content, cwd);
}

/** Save a project pattern. */
export function savePattern(pattern: string, cwd: string): void {
  const content = `- **Pattern**: ${pattern}`;
  saveMemory(content, cwd);
}

// ---- Manual editing ----

/** Get the full memory content for display/editing. */
export function readFullMemory(cwd: string): { global?: string; project?: string } {
  const result: { global?: string; project?: string } = {};

  const globalPath = getGlobalMemoryPath();
  if (existsSync(globalPath)) {
    result.global = readFileSync(globalPath, "utf8");
  }

  const projectPath = getMemoryPath(cwd);
  if (existsSync(projectPath)) {
    result.project = readFileSync(projectPath, "utf8");
  }

  return result;
}

/** Overwrite the project memory file. */
export function writeProjectMemory(content: string, cwd: string): void {
  const memoryDir = getMemoryDirectory(cwd);
  mkdirSync(memoryDir, { recursive: true });
  writeFileSync(getMemoryPath(cwd), content, "utf8");
}

/** Get a summary of memory for display. */
export function getMemorySummary(cwd: string): string {
  const memory = readFullMemory(cwd);
  const lines: string[] = [];

  if (memory.global) {
    const lineCount = memory.global.split("\n").length;
    const sizeKB = Math.round(Buffer.byteLength(memory.global, "utf8") / 1024);
    lines.push(`Global memory: ${lineCount} lines, ${sizeKB}KB`);
  }

  if (memory.project) {
    const lineCount = memory.project.split("\n").length;
    const sizeKB = Math.round(Buffer.byteLength(memory.project, "utf8") / 1024);
    lines.push(`Project memory: ${lineCount} lines, ${sizeKB}KB`);
  }

  if (lines.length === 0) {
    return "No memories saved yet.";
  }

  return lines.join("\n");
}
