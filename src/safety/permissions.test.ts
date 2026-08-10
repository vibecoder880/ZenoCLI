import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSION_MODES,
  PROTECTED_PATHS,
  checkPermission,
  isProtectedPath,
  nextPermissionMode,
  permissionModeLabel,
  type PermissionConfig,
} from "./permissions.js";

describe("Permissions", () => {
  it("lists all 6 permission modes", () => {
    expect(ALL_PERMISSION_MODES).toHaveLength(6);
    expect(ALL_PERMISSION_MODES).toContain("default");
    expect(ALL_PERMISSION_MODES).toContain("acceptEdits");
    expect(ALL_PERMISSION_MODES).toContain("plan");
    expect(ALL_PERMISSION_MODES).toContain("auto");
    expect(ALL_PERMISSION_MODES).toContain("dontAsk");
    expect(ALL_PERMISSION_MODES).toContain("bypassPermissions");
  });

  it("identifies protected paths", () => {
    expect(isProtectedPath("/home/user/.bashrc")).toBe(true);
    expect(isProtectedPath("project/.git/config")).toBe(true);
    expect(isProtectedPath("project/.zenocli/config")).toBe(true);
    expect(isProtectedPath("normal-file.txt")).toBe(false);
  });

  it("lists protected paths", () => {
    expect(PROTECTED_PATHS).toContain(".git");
    expect(PROTECTED_PATHS).toContain(".bashrc");
    expect(PROTECTED_PATHS).toContain(".mcp.json");
  });

  it("auto-approves read-only tools in all modes", () => {
    const modes: Array<PermissionConfig["mode"]> = ["default", "acceptEdits", "plan", "auto", "dontAsk"];

    for (const mode of modes) {
      const prompt = checkPermission("read_file", { path: "test.txt" }, { mode });
      expect(prompt).toBeNull();
    }
  });

  it("prompts for write_file in default mode", () => {
    const prompt = checkPermission("write_file", { path: "test.txt" }, { mode: "default" });
    expect(prompt).not.toBeNull();
  });

  it("auto-approves write_file in acceptEdits mode", () => {
    const prompt = checkPermission("write_file", { path: "test.txt" }, { mode: "acceptEdits" });
    expect(prompt).toBeNull();
  });

  it("blocks write to protected paths even in acceptEdits", () => {
    const prompt = checkPermission("write_file", { path: ".bashrc" }, { mode: "acceptEdits" });
    expect(prompt).not.toBeNull();
    expect(prompt?.reason).toContain("protected");
  });

  it("blocks all non-read tools in plan mode", () => {
    const prompt = checkPermission("write_file", { path: "test.txt" }, { mode: "plan" });
    expect(prompt).not.toBeNull();
    expect(prompt?.reason).toContain("plan mode");
  });

  it("allows everything in bypassPermissions mode", () => {
    const writePrompt = checkPermission("write_file", { path: "test.txt" }, { mode: "bypassPermissions" });
    expect(writePrompt).toBeNull();

    const bashPrompt = checkPermission("write_file", { path: ".bashrc" }, { mode: "bypassPermissions" });
    expect(bashPrompt).toBeNull();
  });

  it("respects dontAsk mode for pre-approved tools", () => {
    // Not pre-approved
    const prompt = checkPermission("write_file", { path: "test.txt" }, { mode: "dontAsk" });
    expect(prompt).not.toBeNull();

    // Pre-approved via config
    const allowed = checkPermission(
      "write_file",
      { path: "test.txt" },
      { mode: "dontAsk", autoApprove: { write_file: true } },
    );
    expect(allowed).toBeNull();
  });

  it("cycles to next permission mode", () => {
    expect(nextPermissionMode("default")).toBe("acceptEdits");
    expect(nextPermissionMode("acceptEdits")).toBe("plan");
    expect(nextPermissionMode("plan")).toBe("auto");
    expect(nextPermissionMode("auto")).toBe("dontAsk");
    expect(nextPermissionMode("dontAsk")).toBe("bypassPermissions");
    expect(nextPermissionMode("bypassPermissions")).toBe("default"); // cycle back
  });

  it("returns human-readable label", () => {
    expect(permissionModeLabel("default")).toContain("Default");
    expect(permissionModeLabel("bypassPermissions")).toContain("Bypass");
  });

  it("uses autoApprove config to skip prompts", () => {
    const config: PermissionConfig = { mode: "default", autoApprove: { run_command: true } };
    const prompt = checkPermission("run_command", { cmd: "ls" }, config);
    expect(prompt).toBeNull();
  });
});
