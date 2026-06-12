import { describe, expect, it, beforeEach } from "vitest";
import { HookRunner, loadHooksFromConfig } from "./hooks.js";

describe("HookRunner", () => {
  let runner: HookRunner;

  beforeEach(() => {
    runner = new HookRunner();
  });

  it("starts with no hooks", () => {
    expect(runner.count).toBe(0);
  });

  it("registers a hook", () => {
    runner.addHook({ event: "PreToolUse", command: "echo test" });
    expect(runner.count).toBe(1);
  });

  it("filters hooks by event", () => {
    runner.addHook({ event: "PreToolUse", command: "echo a" });
    runner.addHook({ event: "PostToolUse", command: "echo b" });
    runner.addHook({ event: "SessionStart", command: "echo c" });

    expect(runner.getHooks("PreToolUse")).toHaveLength(1);
    expect(runner.getHooks("PostToolUse")).toHaveLength(1);
    expect(runner.getHooks("SessionStart")).toHaveLength(1);
    expect(runner.getHooks("SessionEnd")).toHaveLength(0);
  });

  it("filters hooks by tool name match", () => {
    runner.addHook({ event: "PreToolUse", match: "edit_file", command: "echo edit" });
    runner.addHook({ event: "PreToolUse", match: "write_file", command: "echo write" });

    const matching = runner.getHooks("PreToolUse").filter(
      (h) => !h.match || h.match.includes("edit")
    );
    expect(matching).toHaveLength(1);
  });

  it("fires a hook command and returns output", async () => {
    runner.addHook({ event: "PreToolUse", command: "echo hello" });

    const result = await runner.fire("PreToolUse", { cwd: process.cwd() });
    expect(result.proceed).toBe(true);
    expect(result.output).toContain("hello");
  });

  it("expands template variables", async () => {
    runner.addHook({
      event: "PreToolUse",
      command: "echo ${file}",
    });

    const result = await runner.fire("PreToolUse", {
      cwd: process.cwd(),
      toolName: "edit_file",
      params: { path: "test.txt" },
    });

    expect(result.output).toContain("test.txt");
  });

  it("includes prompt output", async () => {
    runner.addHook({
      event: "SessionStart",
      prompt: "Starting a new session in ${cwd}",
    });

    const result = await runner.fire("SessionStart", { cwd: "/tmp" });
    expect(result.output).toContain("Starting a new session in /tmp");
  });

  it("returns proceed=true when no hooks", async () => {
    const result = await runner.fire("PreToolUse", { cwd: process.cwd() });
    expect(result.proceed).toBe(true);
    expect(result.output).toBeUndefined();
  });

  it("continues after hook command error", async () => {
    runner.addHook({ event: "PreToolUse", command: "false" }); // exits 1

    const result = await runner.fire("PreToolUse", { cwd: process.cwd() });
    // Hook doesn't block on non-zero exit (only on explicit proceed=false)
    expect(result.proceed).toBe(true);
  });

  it("clears all hooks", () => {
    runner.addHook({ event: "PreToolUse", command: "echo" });
    runner.addHook({ event: "PostToolUse", command: "echo" });
    expect(runner.count).toBe(2);

    runner.clear();
    expect(runner.count).toBe(0);
  });
});

describe("loadHooksFromConfig", () => {
  it("loads PreToolUse hooks from config", () => {
    const config = {
      hooks: {
        PreToolUse: [
          { match: "edit_file", command: "echo a" },
          { match: "write_file", command: "echo b" },
        ],
      },
    };

    const hooks = loadHooksFromConfig(config);
    expect(hooks).toHaveLength(2);
    expect(hooks[0].event).toBe("PreToolUse");
    expect(hooks[0].match).toBe("edit_file");
  });

  it("returns empty for config without hooks", () => {
    expect(loadHooksFromConfig({})).toEqual([]);
    expect(loadHooksFromConfig({ hooks: {} })).toEqual([]);
  });

  it("handles missing config sections gracefully", () => {
    const config = { hooks: { PreToolUse: undefined, PostToolUse: [] } };
    const hooks = loadHooksFromConfig(config);
    expect(hooks).toEqual([]);
  });
});
