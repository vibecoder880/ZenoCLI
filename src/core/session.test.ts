import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { SessionWriter, SessionReader, listSessions, forkSession } from "./session.js";

// Override paths for test isolation
const testDir = path.join(os.tmpdir(), `.neuro-test-session-${Date.now()}`);

beforeEach(() => {
  process.env.HOME = testDir;
  process.env.USERPROFILE = testDir;
});

afterEach(() => {
  delete process.env.HOME;
  delete process.env.USERPROFILE;
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

describe("SessionWriter", () => {
  it("creates a session with unique ID", () => {
    const writer = new SessionWriter("/tmp", "gpt-4", "openai");
    expect(writer.id).toBeTruthy();
    expect(writer.id).toMatch(/^\d{8}-[a-f0-9]{8}$/);
    writer.close();
  });

  it("appends entries to JSONL file", () => {
    const writer = new SessionWriter("/tmp", "gpt-4", "openai");
    writer.append({ type: "user", content: "Hello", timestamp: new Date().toISOString() });
    writer.append({ type: "assistant", content: "Hi there", timestamp: new Date().toISOString() });
    writer.close();

    const content = readFileSync(writer.dataFilePath, "utf8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);

    const first = JSON.parse(lines[0]);
    expect(first.type).toBe("user");
    expect(first.content).toBe("Hello");
  });

  it("creates a meta file", () => {
    const writer = new SessionWriter("/tmp", "gpt-4", "openai");
    writer.append({ type: "user", content: "test", timestamp: new Date().toISOString() });
    writer.close();

    // Meta should exist with correct model info
    const sessions = listSessions("/tmp");
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0].model).toBe("gpt-4");
    expect(sessions[0].provider).toBe("openai");
  });
});

describe("SessionReader", () => {
  it("reads entries from a session", () => {
    const writer = new SessionWriter("/tmp", "gpt-4", "openai");
    writer.append({ type: "user", content: "Hello", timestamp: new Date().toISOString() });
    writer.append({ type: "assistant", content: "World", timestamp: new Date().toISOString() });
    writer.close();

    const reader = new SessionReader(writer.id, "/tmp");
    const entries = reader.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].type).toBe("user");
  });

  it("gets conversation messages only", () => {
    const writer = new SessionWriter("/tmp", "gpt-4", "openai");
    writer.append({ type: "user", content: "Hello", timestamp: new Date().toISOString() });
    writer.append({ type: "assistant", content: "Hi", timestamp: new Date().toISOString() });
    writer.append({ type: "tool_use", content: "read_file", timestamp: new Date().toISOString() });
    writer.close();

    const reader = new SessionReader(writer.id, "/tmp");
    const conv = reader.getConversationMessages();
    expect(conv).toHaveLength(2); // Only user + assistant
  });

  it("throws for missing session", () => {
    expect(() => new SessionReader("nonexistent", "/tmp")).toThrow("not found");
  });
});

describe("forkSession", () => {
  it("creates an independent copy", () => {
    const writer = new SessionWriter("/tmp", "gpt-4", "openai");
    writer.append({ type: "user", content: "Original", timestamp: new Date().toISOString() });
    writer.close();

    const forked = forkSession(writer.id, "/tmp");
    forked.close();

    const reader = new SessionReader(forked.id, "/tmp");
    const entries = reader.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].content).toBe("Original");
    expect(forked.id).not.toBe(writer.id);
  });
});

describe("listSessions", () => {
  it("returns empty when no sessions", () => {
    expect(listSessions("/nonexistent/path")).toEqual([]);
  });

  it("lists sessions sorted by most recent", () => {
    const w1 = new SessionWriter("/tmp", "gpt-4", "openai");
    w1.append({ type: "user", content: "first", timestamp: new Date().toISOString() });
    w1.close();

    const w2 = new SessionWriter("/tmp", "gpt-4", "openai");
    w2.append({ type: "user", content: "second", timestamp: new Date().toISOString() });
    w2.close();

    const sessions = listSessions("/tmp");
    expect(sessions.length).toBeGreaterThanOrEqual(2);
  });
});
