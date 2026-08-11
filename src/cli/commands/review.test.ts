import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { severityExitCode } from "./review.js";

vi.mock("../../agent/subagent.js", () => ({
  spawnTypedSubagent: async () => ({
    output: "## Issues\n- **Critical**: sql injection in query builder\n- **Minor**: unused import",
    tokensUsed: 10,
    filesChanged: [],
    success: true,
    turns: 1,
    toolsUsed: [],
  }),
}));

vi.mock("../../providers/index.js", () => ({
  createProvider: () => ({
    name: "Stub", slug: "stub", authMethods: ["api_key"],
    chat: async function* () { yield { type: "done" }; },
    listModels: async () => [], healthCheck: async () => ({ ok: true }),
  }),
}));

vi.mock("../../storage/config.js", () => ({
  loadConfig: () => ({
    default: { provider: "openai", model: "gpt-4.1-mini", streaming: true },
    context: { ignore: [] },
  }),
}));

vi.mock("../../providers/router-fallback.js", () => ({
  selectUsableRoute: () => ({
    route: { provider: "openai", model: "gpt-4.1-mini" },
    warning: undefined,
  }),
}));

vi.mock("../../auth/auth-profiles.js", () => ({
  AuthProfileStore: class {
    getActiveProfile() {
      return undefined;
    }
  },
}));

vi.mock("../../auth/refresh.js", () => ({
  refreshOAuthIfNeeded: async () => false,
}));

const originalExitCode = process.exitCode;
const writeSpy = vi.spyOn(process.stdout, "write");
const errSpy = vi.spyOn(process.stderr, "write");

beforeEach(() => {
  writeSpy.mockClear();
  errSpy.mockClear();
  process.exitCode = originalExitCode;
});

afterEach(() => {
  process.exitCode = originalExitCode;
  vi.clearAllMocks();
});

describe("severityExitCode", () => {
  it("returns 1 for critical findings", () => {
    expect(severityExitCode("Critical: security issue")).toBe(1);
    expect(severityExitCode("data loss risk")).toBe(1);
  });

  it("returns 1 for major/bug findings", () => {
    expect(severityExitCode("Major: refactor needed")).toBe(1);
    expect(severityExitCode("found a bug")).toBe(1);
  });

  it("returns 0 for clean or minor-only output", () => {
    expect(severityExitCode("Minor: rename variable")).toBe(0);
    expect(severityExitCode("All good")).toBe(0);
  });
});
