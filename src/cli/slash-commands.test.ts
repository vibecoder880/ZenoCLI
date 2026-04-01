import { describe, expect, it } from "vitest";
import { filterSlashCommands, SLASH_COMMANDS } from "./slash-commands.js";

describe("filterSlashCommands", () => {
  it("returns no commands for non-slash input", () => {
    expect(filterSlashCommands("hello")).toEqual([]);
  });

  it("returns all slash commands for a bare slash", () => {
    expect(filterSlashCommands("/")).toEqual(SLASH_COMMANDS);
  });

  it("filters commands by substring", () => {
    expect(filterSlashCommands("/mo")).toEqual([
      { command: "/model", description: "Switch active model" }
    ]);
  });
});
