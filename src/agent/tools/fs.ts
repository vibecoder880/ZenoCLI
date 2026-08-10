/**
 * Filesystem tools: glob, grep, read_file, write_file, edit_file, list_dir
 * All registered with the dynamic ToolRegistry.
 */

import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ToolDefinition, ToolExecutionContext, ToolResult } from "../tool-registry.js";

// ---- Helpers ----

/**
 * Resolve a tool-supplied path against the working directory and confine the
 * result to the workspace. Prevents path traversal: inputs such as "/etc",
 * "C:\\...", or "../../.." resolve outside `cwd` and are rejected instead of
 * reaching the filesystem. Symlinked entries inside the workspace are still
 * followed; the containment check is lexical on the resolved path.
 */
function resolvePath(cwd: string, targetPath: string): string {
  const resolved = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(cwd, targetPath);

  const workspace = path.resolve(cwd);
  const relative = path.relative(workspace, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path "${targetPath}" escapes the workspace and was blocked.`);
  }

  return resolved;
}

function isIgnored(targetPath: string, ignore: string[]): boolean {
  return ignore.some((part) => targetPath.split(path.sep).includes(part));
}

/** Convert a glob pattern to a RegExp. Supports *, **, ? */
function globToRegex(pattern: string): RegExp {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/\{\{GLOBSTAR\}\}/g, ".*");
  return new RegExp(`^${regexStr}$`, "i");
}

// ---- Tools ----

const readFileTool: ToolDefinition = {
  name: "read_file",
  description: "Read a UTF-8 text file. Supports optional line range.",
  category: "fs",
  safety: "safe",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file, relative to cwd or absolute." },
      offset: { type: "number", description: "Starting line number (1-based, optional)." },
      limit: { type: "number", description: "Number of lines to read (optional)." },
    },
    required: ["path"],
  },
  async execute(params, ctx: ToolExecutionContext): Promise<ToolResult> {
    const targetPath = resolvePath(ctx.cwd, String(params.path ?? ""));
    let content = await readFile(targetPath, "utf8");

    const offset = Number(params.offset);
    const limit = Number(params.limit);

    if (offset > 0 || limit > 0) {
      const lines = content.split("\n");
      const start = offset > 0 ? offset - 1 : 0;
      const end = limit > 0 ? start + limit : lines.length;
      content = lines.slice(start, end)
        .map((line, i) => `${start + i + 1}\t${line}`)
        .join("\n");
    } else {
      content = content.split("\n")
        .map((line, i) => `${i + 1}\t${line}`)
        .join("\n");
    }

    return { output: content };
  },
};

const writeFileTool: ToolDefinition = {
  name: "write_file",
  description: "Write a UTF-8 text file, creating directories if needed.",
  category: "fs",
  safety: "moderate",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file." },
      content: { type: "string", description: "New file content." },
    },
    required: ["path", "content"],
  },
  async execute(params, ctx: ToolExecutionContext): Promise<ToolResult> {
    const targetPath = resolvePath(ctx.cwd, String(params.path ?? ""));
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, String(params.content ?? ""), "utf8");
    return { output: `Wrote ${targetPath}` };
  },
};

const editFileTool: ToolDefinition = {
  name: "edit_file",
  description: "Replace text in a file. Supports single or all occurrences.",
  category: "fs",
  safety: "moderate",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file." },
      search: { type: "string", description: "Exact text to find." },
      replace: { type: "string", description: "Replacement text." },
      replace_all: { type: "boolean", description: "Replace all occurrences (default: first only)." },
    },
    required: ["path", "search", "replace"],
  },
  async execute(params, ctx: ToolExecutionContext): Promise<ToolResult> {
    const targetPath = resolvePath(ctx.cwd, String(params.path ?? ""));
    const search = String(params.search ?? "");
    const replace = String(params.replace ?? "");
    const replaceAll = Boolean(params.replace_all);

    const current = await readFile(targetPath, "utf8");

    if (!current.includes(search)) {
      return { output: "", error: `Search text was not found in ${targetPath}` };
    }

    const updated = replaceAll
      ? current.replaceAll(search, replace)
      : current.replace(search, replace);

    await writeFile(targetPath, updated, "utf8");
    return { output: `Updated ${targetPath}` };
  },
};

const listDirTool: ToolDefinition = {
  name: "list_dir",
  description: "List files and directories in a folder.",
  category: "fs",
  safety: "safe",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Directory path (default: cwd)." },
    },
  },
  async execute(params, ctx: ToolExecutionContext): Promise<ToolResult> {
    const targetPath = resolvePath(ctx.cwd, String(params.path ?? "."));
    const entries = await readdir(targetPath, { withFileTypes: true });
    const lines = entries
      .map((entry) => `${entry.isDirectory() ? "dir " : "file"} ${entry.name}`)
      .join("\n");
    return { output: lines || "(empty directory)" };
  },
};

const globTool: ToolDefinition = {
  name: "glob",
  description: "Find files matching a glob pattern (e.g., **/*.ts, src/**/*.tsx). Returns sorted by modification time.",
  category: "fs",
  safety: "safe",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Glob pattern to match (e.g., **/*.ts)." },
      path: { type: "string", description: "Base directory to search (default: cwd)." },
    },
    required: ["pattern"],
  },
  async execute(params, ctx: ToolExecutionContext): Promise<ToolResult> {
    const searchRoot = resolvePath(ctx.cwd, String(params.path ?? "."));
    const pattern = String(params.pattern ?? "**/*");
    const regex = globToRegex(pattern);
    const maxResults = 200;

    const results: string[] = [];

    async function walk(dir: string): Promise<void> {
      if (results.length >= maxResults) return;
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (results.length >= maxResults) return;
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(searchRoot, fullPath);

        if (isIgnored(fullPath, ctx.ignore)) continue;

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile() && regex.test(relativePath)) {
          results.push(relativePath.replace(/\\/g, "/"));
        }
      }
    }

    await walk(searchRoot);

    return {
      output: results.length > 0
        ? results.join("\n")
        : `No files matching "${pattern}" found.`,
    };
  },
};

const grepTool: ToolDefinition = {
  name: "grep",
  description: "Search file contents with regex. Returns matching lines with file paths and line numbers.",
  category: "search",
  safety: "safe",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Regex pattern to search for." },
      path: { type: "string", description: "Directory or file to search (default: cwd)." },
      "max_results": { type: "number", description: "Maximum results to return (default: 50)." },
    },
    required: ["pattern"],
  },
  async execute(params, ctx: ToolExecutionContext): Promise<ToolResult> {
    const searchRoot = resolvePath(ctx.cwd, String(params.path ?? "."));
    const patternStr = String(params.pattern ?? "");
    const maxResults = Number(params.max_results) || 50;
    let searchRegex: RegExp;

    try {
      searchRegex = new RegExp(patternStr, "i");
    } catch {
      return { output: "", error: `Invalid regex pattern: ${patternStr}` };
    }

    const matches: string[] = [];

    async function searchFile(filePath: string): Promise<void> {
      if (matches.length >= maxResults) return;
      let content: string;
      try {
        content = await readFile(filePath, "utf8");
      } catch {
        return;
      }

      const relativePath = path.relative(ctx.cwd, filePath).replace(/\\/g, "/");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        if (matches.length >= maxResults) return;
        if (searchRegex.test(lines[i])) {
          matches.push(`${relativePath}:${i + 1}: ${lines[i].trim()}`);
        }
      }
    }

    async function walkAndSearch(dir: string): Promise<void> {
      if (matches.length >= maxResults) return;
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (matches.length >= maxResults) return;
        const fullPath = path.join(dir, entry.name);
        if (isIgnored(fullPath, ctx.ignore)) continue;

        if (entry.isDirectory()) {
          await walkAndSearch(fullPath);
        } else if (entry.isFile()) {
          await searchFile(fullPath);
        }
      }
    }

    const rootStat = await stat(searchRoot).catch(() => null);
    if (rootStat?.isFile()) {
      await searchFile(searchRoot);
    } else {
      await walkAndSearch(searchRoot);
    }

    return {
      output: matches.length > 0
        ? matches.join("\n")
        : `No matches for "${patternStr}".`,
    };
  },
};

// ---- Export all definitions ----

export const fsToolDefinitions: ToolDefinition[] = [
  readFileTool,
  writeFileTool,
  editFileTool,
  listDirTool,
  globTool,
  grepTool,
];
