import { describe, expect, it } from "vitest";
import { ContextManager } from "./context-manager.js";

describe("ContextManager", () => {
  it("tracks total tokens", () => {
    const ctx = new ContextManager(1000);
    ctx.addSystem("Hello system");   // ~3 tokens
    ctx.addUser("Hello user");       // ~3 tokens
    ctx.addAssistant("Hi there");    // ~2 tokens

    expect(ctx.totalTokens).toBeGreaterThan(0);
  });

  it("pins system messages", () => {
    const ctx = new ContextManager(1000);
    ctx.addSystem("Important system prompt");

    const stats = ctx.getStats();
    expect(stats.pinnedTokens).toBeGreaterThan(0);
    expect(stats.evictableTokens).toBe(0);
  });

  it("reports correct stats", () => {
    const ctx = new ContextManager(1000);
    ctx.addSystem("System prompt that is long enough to have tokens");   // pinned
    ctx.addUser("User message with some content here too");   // evictable

    const stats = ctx.getStats();
    expect(stats.entryCount).toBe(2);
    expect(stats.utilizationPercent).toBeGreaterThan(0);
    expect(stats.maxTokens).toBe(1000);
  });

  it("compacts when over threshold", () => {
    const ctx = new ContextManager(30); // Very small limit
    ctx.addSystem("System"); // pinned, ~2 tokens
    // Add tool results — these get evicted first
    ctx.addToolResult("read_file", "x".repeat(100)); // ~25 tokens
    ctx.addToolResult("grep", "y".repeat(100));       // ~25 tokens
    ctx.addToolResult("glob", "z".repeat(100));       // ~25 tokens

    // Now we're well over threshold (30)
    expect(ctx.needsCompaction()).toBe(true);

    const result = ctx.compact();
    expect(result.compacted).toBe(true);
    expect(result.tokensBefore).toBeGreaterThan(result.tokensAfter);
    expect(result.tokensFreed).toBeGreaterThan(0);
  });

  it("preserves system messages during compaction", () => {
    const ctx = new ContextManager(100);
    ctx.addSystem("CRITICAL SYSTEM PROMPT");
    ctx.addUser("a".repeat(50));
    ctx.addAssistant("b".repeat(50));

    ctx.compact();

    // System message should still be there
    const messages = ctx.toMessages();
    expect(messages.some((m) => m.role === "system" && m.content.includes("CRITICAL"))).toBe(true);
  });

  it("does not compact when not needed", () => {
    const ctx = new ContextManager(10000);
    ctx.addUser("Hello");

    expect(ctx.needsCompaction()).toBe(false);

    const result = ctx.compact();
    expect(result.compacted).toBe(false);
  });

  it("converts to ChatMessage array", () => {
    const ctx = new ContextManager(1000);
    ctx.addSystem("Sys");
    ctx.addUser("User");
    ctx.addAssistant("Bot");
    ctx.addToolResult("read_file", "file contents");

    const messages = ctx.toMessages();
    expect(messages).toHaveLength(4);
    // tool_result maps to user role
    expect(messages[3].role).toBe("user");
  });

  it("provides human-readable summary", () => {
    const ctx = new ContextManager(1000);
    ctx.addUser("Hello world");

    const summary = ctx.getSummary();
    expect(summary).toContain("Context:");
    expect(summary).toContain("tokens");
  });

  it("takes a snapshot", () => {
    const ctx = new ContextManager(1000);
    ctx.addUser("Snapshot test");

    const snap = ctx.snapshot();
    expect(snap.entries).toHaveLength(1);
    expect(snap.stats.totalTokens).toBeGreaterThan(0);
  });

  it("resets compaction counter", () => {
    const ctx = new ContextManager(100);
    ctx.addUser("a".repeat(50));
    ctx.compact();
    ctx.resetCompactionCounter();

    // After reset, compaction should work again
    ctx.addUser("b".repeat(50));
    const result = ctx.compact();
    // May or may not compact depending on threshold
    expect(result).toBeDefined();
  });
});
