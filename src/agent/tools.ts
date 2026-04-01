import { exec } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface ToolContext {
  cwd: string;
  ignore: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  args: Record<string, string>;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "read_file",
    description: "Read a UTF-8 text file.",
    args: { path: "Path to the file, relative to cwd or absolute." }
  },
  {
    name: "write_file",
    description: "Write a UTF-8 text file, creating directories if needed.",
    args: {
      path: "Path to the file, relative to cwd or absolute.",
      content: "New file content."
    }
  },
  {
    name: "edit_file",
    description: "Replace the first occurrence of a search string in a file.",
    args: {
      path: "Path to the file, relative to cwd or absolute.",
      search: "Exact text to replace.",
      replace: "Replacement text."
    }
  },
  {
    name: "list_dir",
    description: "List files and directories in a folder.",
    args: { path: "Directory path, relative to cwd or absolute." }
  },
  {
    name: "search_code",
    description: "Search for a text query across files.",
    args: {
      query: "Text to search for.",
      path: "Optional directory path, relative to cwd or absolute."
    }
  },
  {
    name: "run_command",
    description: "Run a shell command in the project directory.",
    args: { cmd: "Shell command to execute." }
  }
];

function resolvePath(cwd: string, targetPath: string): string {
  return path.isAbsolute(targetPath) ? targetPath : path.join(cwd, targetPath);
}

function isIgnored(targetPath: string, ignore: string[]): boolean {
  return ignore.some((part) => targetPath.split(path.sep).includes(part));
}

function ensureSafeCommand(command: string): void {
  const forbiddenPatterns = [
    /\brm\s+-rf\b/i,
    /\bdel\s+\/f\b/i,
    /\brmdir\s+\/s\b/i,
    /\bgit\s+push\b/i,
    /\bgit\s+reset\s+--hard\b/i
  ];

  if (forbiddenPatterns.some((pattern) => pattern.test(command))) {
    throw new Error(`Command blocked by safety policy: ${command}`);
  }
}

async function searchFiles(root: string, query: string, ignore: string[], matches: string[]): Promise<void> {
  const entries = await readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);

    if (isIgnored(fullPath, ignore)) {
      continue;
    }

    if (entry.isDirectory()) {
      await searchFiles(fullPath, query, ignore, matches);
      if (matches.length >= 20) {
        return;
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const content = await readFile(fullPath, "utf8").catch(() => undefined);

    if (!content) {
      continue;
    }

    const index = content.toLowerCase().indexOf(query.toLowerCase());

    if (index >= 0) {
      const lineNumber = content.slice(0, index).split("\n").length;
      matches.push(`${path.relative(root, fullPath)}:${lineNumber}`);
    }

    if (matches.length >= 20) {
      return;
    }
  }
}

export async function executeTool(
  tool: string,
  rawArgs: Record<string, unknown>,
  context: ToolContext
): Promise<string> {
  switch (tool) {
    case "read_file": {
      const targetPath = resolvePath(context.cwd, String(rawArgs.path ?? ""));
      return await readFile(targetPath, "utf8");
    }

    case "write_file": {
      const targetPath = resolvePath(context.cwd, String(rawArgs.path ?? ""));
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, String(rawArgs.content ?? ""), "utf8");
      return `Wrote ${targetPath}`;
    }

    case "edit_file": {
      const targetPath = resolvePath(context.cwd, String(rawArgs.path ?? ""));
      const search = String(rawArgs.search ?? "");
      const replace = String(rawArgs.replace ?? "");
      const current = await readFile(targetPath, "utf8");

      if (!current.includes(search)) {
        throw new Error(`Search text was not found in ${targetPath}`);
      }

      await writeFile(targetPath, current.replace(search, replace), "utf8");
      return `Updated ${targetPath}`;
    }

    case "list_dir": {
      const targetPath = resolvePath(context.cwd, String(rawArgs.path ?? "."));
      const entries = await readdir(targetPath, { withFileTypes: true });
      return entries
        .map((entry) => `${entry.isDirectory() ? "dir " : "file"} ${entry.name}`)
        .join("\n");
    }

    case "search_code": {
      const searchRoot = resolvePath(context.cwd, String(rawArgs.path ?? "."));
      const query = String(rawArgs.query ?? "");
      const matches: string[] = [];
      await searchFiles(searchRoot, query, context.ignore, matches);
      return matches.length > 0 ? matches.join("\n") : "No matches found.";
    }

    case "run_command": {
      const command = String(rawArgs.cmd ?? "");
      ensureSafeCommand(command);
      const { stdout, stderr } = await execAsync(command, { cwd: context.cwd });
      return [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
    }

    default:
      throw new Error(`Unknown tool "${tool}".`);
  }
}

export async function describeWorkspace(cwd: string, ignore: string[]): Promise<string> {
  const entries = await readdir(cwd, { withFileTypes: true });
  const lines = await Promise.all(
    entries
      .filter((entry) => !isIgnored(path.join(cwd, entry.name), ignore))
      .slice(0, 20)
      .map(async (entry) => {
        const fullPath = path.join(cwd, entry.name);
        if (entry.isDirectory()) {
          return `dir ${entry.name}`;
        }

        const fileStat = await stat(fullPath);
        return `file ${entry.name} (${fileStat.size} bytes)`;
      })
  );

  return lines.join("\n");
}
