import { describe, expect, it } from "vitest";
import { createActivityAggregator } from "./types.js";

function toolStart(name: string): { type: "tool_start"; toolName: string; content: string } {
  return { type: "tool_start", toolName: name, content: `Using ${name}` };
}

function toolResult(name: string, content: string): { type: "tool_result"; toolName: string; content: string } {
  return { type: "tool_result", toolName: name, content };
}

function error(name: string, content: string): { type: "error"; toolName: string; content: string } {
  return { type: "error", toolName: name, content };
}

describe("ActivityAggregator", () => {
  it("starts a running line on tool_start", () => {
    const agg = createActivityAggregator();
    const lines = agg.process(toolStart("read_file"));
    expect(lines.length).toBe(1);
    expect(lines[0].toolName).toBe("read_file");
    expect(lines[0].status).toBe("running");
    expect(lines[0].summary).toBe("● read_file");
  });

  it("completes to OK on tool_result", () => {
    const agg = createActivityAggregator();
    agg.process(toolStart("read_file"));
    const lines = agg.process(toolResult("read_file", "src/auth.ts"));
    expect(lines[0].status).toBe("ok");
    expect(lines[0].summary).toContain("✓ read_file");
    expect(lines[0].detail).toContain("src/auth.ts");
  });

  it("marks error on error event", () => {
    const agg = createActivityAggregator();
    const lines = agg.process(error("edit_file", "permission denied"));
    expect(lines[0].status).toBe("error");
    expect(lines[0].summary).toBe("× edit_file error");
    expect(lines[0].expanded).toBe(true);
  });

  it("merges multiple tool_result for the same toolName", () => {
    const agg = createActivityAggregator();
    agg.process(toolStart("read_file"));
    agg.process(toolResult("read_file", "src/auth.ts"));
    const lines = agg.process(toolResult("read_file", "src/token.ts"));
    expect(lines.length).toBe(1);
    expect(lines[0].summary).toContain("(2)");
    expect(lines[0].detail).toContain("src/auth.ts");
    expect(lines[0].detail).toContain("src/token.ts");
  });

  it("preserves invocation order", () => {
    const agg = createActivityAggregator();
    agg.process(toolStart("read_file"));
    agg.process(toolStart("edit_file"));
    agg.process(toolResult("read_file", "src/a.ts"));
    agg.process(toolResult("edit_file", "src/b.ts"));
    const lines = agg.getLines();
    expect(lines.map((l) => l.toolName)).toEqual(["read_file", "edit_file"]);
  });

  it("toggles expanded state", () => {
    const agg = createActivityAggregator();
    agg.process(toolStart("read_file"));
    agg.process(toolResult("read_file", "src/a.ts"));
    let lines = agg.getLines();
    expect(lines[0].expanded).toBe(false);
    lines = agg.toggle("read_file");
    expect(lines[0].expanded).toBe(true);
    lines = agg.toggle("read_file");
    expect(lines[0].expanded).toBe(false);
  });

  it("clears on new turn", () => {
    const agg = createActivityAggregator();
    agg.process(toolStart("read_file"));
    agg.process(toolResult("read_file", "src/a.ts"));
    agg.clear();
    expect(agg.getLines().length).toBe(0);
  });
});