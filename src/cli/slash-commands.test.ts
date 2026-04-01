import { describe, expect, it } from "vitest";
import { filterSlashCommands, findSlashCommand, SLASH_COMMANDS } from "./slash-commands.js";

describe("filterSlashCommands", () => {
  it("returns no commands for non-slash input", () => {
    expect(filterSlashCommands("hello")).toEqual([]);
  });

  it("returns all slash commands for a bare slash", () => {
    expect(filterSlashCommands("/")).toEqual(SLASH_COMMANDS);
  });

  it("filters commands by substring", () => {
    expect(filterSlashCommands("/mo")).toEqual([
      { command: "/model", description: "Switch active model" },
      { command: "/models", description: "List aliases and models" }
    ]);
  });

  it("finds an exact slash command", () => {
    expect(findSlashCommand("/history")).toEqual({
      command: "/history",
      description: "Show recent history"
    });
  });
});
