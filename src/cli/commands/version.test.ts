import { describe, expect, it, vi } from "vitest";
import { runVersionCommand } from "./version.js";
import packageJson from "../../../package.json" with { type: "json" };

describe("version command", () => {
  it("prints the package version", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    runVersionCommand();

    expect(log).toHaveBeenCalledWith(`zeno-cli ${packageJson.version}`);
    log.mockRestore();
  });
});
