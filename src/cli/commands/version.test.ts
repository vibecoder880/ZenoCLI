import { describe, expect, it, vi } from "vitest";
import { runVersionCommand } from "./version.js";

describe("version command", () => {
  it("prints the package version", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    runVersionCommand();

    expect(log).toHaveBeenCalledWith("zeno-cli 0.2.0");
    log.mockRestore();
  });
});
