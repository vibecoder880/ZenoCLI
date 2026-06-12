import { describe, expect, it, beforeEach } from "vitest";
import { registerTool, getTool, getAllTools, executeTool, clearRegistry, getToolSpecsForPrompt, registerTools, getToolsByCategory } from "./tool-registry.js";
import type { ToolDefinition } from "./tool-registry.js";

describe("ToolRegistry", () => {
  beforeEach(() => {
    clearRegistry();
  });

  it("registers and retrieves a tool", () => {
    const tool: ToolDefinition = {
      name: "test_tool",
      description: "A test tool",
      category: "fs",
      safety: "safe",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "file path" } },
      },
      execute: async () => ({ output: "done" }),
    };

    registerTool(tool);
    expect(getTool("test_tool")).toBe(tool);
  });

  it("returns undefined for unknown tool", () => {
    expect(getTool("nonexistent")).toBeUndefined();
  });

  it("registers multiple tools at once", () => {
    const tools: ToolDefinition[] = [
      {
        name: "tool_a",
        description: "Tool A",
        category: "fs",
        safety: "safe",
        parameters: { type: "object", properties: {} },
        execute: async () => ({ output: "a" }),
      },
      {
        name: "tool_b",
        description: "Tool B",
        category: "search",
        safety: "safe",
        parameters: { type: "object", properties: {} },
        execute: async () => ({ output: "b" }),
      },
    ];

    registerTools(tools);
    expect(getAllTools()).toHaveLength(2);
  });

  it("filters tools by category", () => {
    registerTool({
      name: "fs_tool",
      description: "FS",
      category: "fs",
      safety: "safe",
      parameters: { type: "object", properties: {} },
      execute: async () => ({ output: "" }),
    });
    registerTool({
      name: "search_tool",
      description: "Search",
      category: "search",
      safety: "safe",
      parameters: { type: "object", properties: {} },
      execute: async () => ({ output: "" }),
    });

    expect(getToolsByCategory("fs")).toHaveLength(1);
    expect(getToolsByCategory("search")).toHaveLength(1);
  });

  it("executes a registered tool", async () => {
    registerTool({
      name: "echo",
      description: "Echo input",
      category: "orchestration",
      safety: "safe",
      parameters: { type: "object", properties: { msg: { type: "string", description: "message" } } },
      execute: async (params) => ({ output: `Echo: ${params.msg}` }),
    });

    const result = await executeTool("echo", { msg: "hello" }, { cwd: "/tmp", ignore: [] });
    expect(result.output).toBe("Echo: hello");
  });

  it("returns error for unknown tool execution", async () => {
    const result = await executeTool("missing", {}, { cwd: "/tmp", ignore: [] });
    expect(result.error).toContain("Unknown tool");
  });

  it("handles tool execution errors gracefully", async () => {
    registerTool({
      name: "fail_tool",
      description: "Always fails",
      category: "fs",
      safety: "dangerous",
      parameters: { type: "object", properties: {} },
      execute: async () => { throw new Error("boom"); },
    });

    const result = await executeTool("fail_tool", {}, { cwd: "/tmp", ignore: [] });
    expect(result.error).toBe("boom");
  });

  it("generates tool specs for prompt", () => {
    registerTool({
      name: "read_file",
      description: "Read a file",
      category: "fs",
      safety: "safe",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "File path" } },
      },
      execute: async () => ({ output: "" }),
    });

    const specs = getToolSpecsForPrompt();
    expect(specs).toContain("read_file");
    expect(specs).toContain("Read a file");
    expect(specs).toContain("File path");
  });

  it("overwrites tool on re-register", () => {
    registerTool({
      name: "dup",
      description: "First",
      category: "fs",
      safety: "safe",
      parameters: { type: "object", properties: {} },
      execute: async () => ({ output: "first" }),
    });
    registerTool({
      name: "dup",
      description: "Second",
      category: "fs",
      safety: "safe",
      parameters: { type: "object", properties: {} },
      execute: async () => ({ output: "second" }),
    });

    expect(getAllTools()).toHaveLength(1);
    expect(getTool("dup")?.description).toBe("Second");
  });
});
