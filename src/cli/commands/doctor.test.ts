import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rmSync } from "node:fs";
import { runDoctorCommand } from "./doctor.js";

const tempHome = "D:/VibeCoder/NeuroCli/.tmp-doctor-home";
const tempWorkspace = "D:/VibeCoder/NeuroCli/.tmp-doctor-workspace";

describe("doctor command", () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  beforeEach(() => {
    rmSync(tempHome, { recursive: true, force: true });
    rmSync(tempWorkspace, { recursive: true, force: true });
    vi.stubEnv("HOME", tempHome);
    vi.stubEnv("USERPROFILE", tempHome);
    log.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(tempHome, { recursive: true, force: true });
    rmSync(tempWorkspace, { recursive: true, force: true });
  });

  it("prints environment and storage diagnostics", async () => {
    await runDoctorCommand(tempWorkspace);

    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("Environment");
    expect(output).toContain("Storage");
    expect(output).toContain("Providers");
    expect(output).toContain("Release Readiness");
  });
});
