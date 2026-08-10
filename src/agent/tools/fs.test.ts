import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fsToolDefinitions } from "./fs.js";
import type { ToolDefinition, ToolExecutionContext, ToolResult } from "../tool-registry.js";

function makeContext(cwd: string): ToolExecutionContext {
  return { cwd, ignore: ["node_modules", ".git", "dist"] };
}

function findTool(name: string): ToolDefinition {
  const tool = fsToolDefinitions.find((entry) => entry.name === name);
  if (!tool) {
    throw new Error(`Test tool "${name}" not found`);
  }
  return tool;
}

/** Run a tool like the registry does: catch thrown errors into ToolResult.error. */
async function run(tool: ToolDefinition, params: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
  try {
    return await tool.execute(params, ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { output: "", error: message };
  }
}

describe("filesystem tools confine access to the workspace", () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), ".zeno-fs-test-"));
  const ctx = makeContext(cwd);

  it("blocks absolute paths that escape the workspace", async () => {
    const result = await run(findTool("read_file"), { path: "/etc/passwd" }, ctx);
    expect(result.error).toMatch(/escapes the workspace/);
  });

  it("blocks parent-directory traversal", async () => {
    const result = await run(findTool("write_file"), { path: "../../etc/evil.sh", content: "x" }, ctx);
    expect(result.error).toMatch(/escapes the workspace/);
  });

  it("blocks list_dir on an escaping path", async () => {
    const result = await run(findTool("list_dir"), { path: "/" }, ctx);
    expect(result.error).toMatch(/escapes the workspace/);
  });

  it("allows reading a file inside the workspace", async () => {
    const filePath = path.join(cwd, "hello.txt");
    writeFileSync(filePath, "hi");
    const result = await run(findTool("read_file"), { path: "hello.txt" }, ctx);
    expect(result.output).toContain("hi");
  });

  it("writes files inside the workspace using relative paths", async () => {
    mkdirSync(path.join(cwd, "nested"), { recursive: true });
    const result = await run(findTool("write_file"), { path: "nested/out.txt", content: "data" }, ctx);
    expect(result.error).toBeUndefined();
  });

  it("confines glob and grep base directories", async () => {
    const globResult = await run(findTool("glob"), { pattern: "**/*.ts", path: "/tmp" }, ctx);
    expect(globResult.error).toMatch(/escapes the workspace/);

    const grepResult = await run(findTool("grep"), { pattern: "x", path: "/etc" }, ctx);
    expect(grepResult.error).toMatch(/escapes the workspace/);
  });

  afterAll(() => {
    rmSync(cwd, { recursive: true, force: true });
  });
});