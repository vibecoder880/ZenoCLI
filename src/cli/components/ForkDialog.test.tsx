import { describe, expect, it, vi } from "vitest";
import { forkSession } from "../../core/session.js";

vi.mock("../../core/session.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../core/session.js")>();
  return {
    ...actual,
    forkSession: vi.fn((sessionId: string, cwd: string, upToIndex?: number) => ({
      id: `forked-${sessionId}-${upToIndex ?? "full"}`,
      cwd,
    })),
  };
});

describe("forkSession truncation", () => {
  it("forwards upToIndex to the underlying fork", () => {
    const writer = forkSession("session-1", "/tmp", 3);
    expect(writer.id).toContain("forked-session-1-3");
    expect(vi.mocked(forkSession)).toHaveBeenCalledWith("session-1", "/tmp", 3);
  });

  it("forks the whole session when upToIndex is omitted", () => {
    const writer = forkSession("session-1", "/tmp");
    expect(writer.id).toContain("forked-session-1-full");
  });
});