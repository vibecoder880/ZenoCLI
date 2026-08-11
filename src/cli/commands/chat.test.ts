import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runChatCommand } from "./chat.js";

class StubProvider {
  readonly name = "Stub";
  readonly slug = "stub";
  readonly authMethods = ["api_key"] as const;

  async *chat() {
    yield { type: "text", content: "stub answer" };
    yield { type: "done", usage: { totalTokens: 4, inputTokens: 2, outputTokens: 2 } };
  }

  async listModels() {
    return [];
  }

  async healthCheck() {
    return { ok: true, message: "OK" };
  }
}

// Route "stub-provider/stub-model" to the stub provider so the command works
// without any real credentials.
vi.mock("../../providers/index.js", () => ({
  createProvider: (slug: string) => {
    if (slug === "stub-provider") {
      return new StubProvider();
    }
    throw new Error(`unexpected provider ${slug}`);
  },
}));

vi.mock("../../storage/config.js", () => ({
  loadConfig: () => ({
    default: { provider: "stub-provider", model: "stub-model", streaming: true },
    context: { ignore: [] },
  }),
}));

vi.mock("../../providers/router-fallback.js", () => ({
  selectUsableRoute: () => ({
    route: { provider: "stub-provider", model: "stub-model" },
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

vi.mock("../../core/context.js", () => ({
  loadProjectInstructions: () => undefined,
}));

const writeSpy = vi.spyOn(process.stdout, "write");
const originalExitCode = process.exitCode;

beforeEach(() => {
  writeSpy.mockClear();
  process.exitCode = originalExitCode;
});

afterEach(() => {
  process.exitCode = originalExitCode;
  vi.clearAllMocks();
});

describe("chat command headless mode", () => {
  it("prints the plain response text in non-interactive mode", async () => {
    await runChatCommand({ prompt: "hi", cwd: "/tmp", nonInteractive: true });

    const out = writeSpy.mock.calls.flat().map((c) => String(c)).join("");
    expect(out).toContain("stub answer");
  });

  it("keeps interactive output (warning + trailing newline) by default", async () => {
    await runChatCommand({ prompt: "hi", cwd: "/tmp" });

    const out = writeSpy.mock.calls.flat().map((c) => String(c)).join("");
    expect(out).toContain("stub answer");
  });
});
