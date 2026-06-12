import { describe, expect, it } from "vitest";
import {
  filterSlashCommands,
  findSlashCommand,
  getSlashCommandsByCategory,
  SLASH_CATEGORY_LABELS,
  SLASH_COMMANDS
} from "./slash-commands.js";

describe("filterSlashCommands", () => {
  it("returns no commands for non-slash input", () => {
    expect(filterSlashCommands("hello")).toEqual([]);
  });

  it("returns all slash commands for a bare slash", () => {
    expect(filterSlashCommands("/")).toEqual(SLASH_COMMANDS);
  });

  it("filters commands by substring", () => {
    expect(filterSlashCommands("/mo")).toEqual([
      { command: "/model", description: "Switch active model", category: "info" },
      { command: "/models", description: "List aliases and models", category: "debug" },
      { command: "/memory", description: "Show auto-memory", category: "session" }
    ]);
  });

  it("finds an exact slash command", () => {
    expect(findSlashCommand("/history")).toEqual({
      command: "/history",
      description: "Show recent history",
      category: "info"
    });
  });

  it("includes init in the slash command list", () => {
    expect(SLASH_COMMANDS.some((entry) => entry.command === "/init")).toBe(true);
  });
});

describe("slash command categories", () => {
  it("tags every command with a valid category", () => {
    for (const command of SLASH_COMMANDS) {
      expect(Object.keys(SLASH_CATEGORY_LABELS)).toContain(command.category);
    }
  });

  it("groups commands by category", () => {
    const grouped = getSlashCommandsByCategory();
    expect(grouped.mode.length).toBeGreaterThan(0);
    expect(grouped.session.length).toBeGreaterThan(0);
    expect(grouped.debug.length).toBeGreaterThan(0);
    expect(grouped.info.length).toBeGreaterThan(0);
  });

  it("preserves total command count after grouping", () => {
    const grouped = getSlashCommandsByCategory();
    const total = Object.values(grouped).reduce((sum, list) => sum + list.length, 0);
    expect(total).toBe(SLASH_COMMANDS.length);
  });
});
