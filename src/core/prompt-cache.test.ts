import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { PromptCache } from "./prompt-cache.js";

const testDir = path.join(os.tmpdir(), `.neuro-test-cache-${Date.now()}`);

beforeEach(() => {
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

describe("PromptCache", () => {
  it("returns undefined for missing key", () => {
    const cache = new PromptCache();
    expect(cache.get("nonexistent")).toBeUndefined();
  });

  it("stores and retrieves content", () => {
    const cache = new PromptCache();
    cache.set("key1", "cached content", 10);
    expect(cache.get("key1")).toBe("cached content");
  });

  it("expires entries after TTL", async () => {
    const cache = new PromptCache(50); // 50ms TTL
    cache.set("key1", "content", 10);
    expect(cache.get("key1")).toBe("content");

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(cache.get("key1")).toBeUndefined();
  });

  it("invalidates on file change", async () => {
    const filePath = path.join(testDir, "config.md");
    writeFileSync(filePath, "original", "utf8");

    const cache = new PromptCache(60_000);
    cache.set("config", "cached", 10, filePath);
    expect(cache.get("config", filePath)).toBe("cached");

    // Wait a bit and modify the file
    await new Promise((resolve) => setTimeout(resolve, 50));
    writeFileSync(filePath, "modified", "utf8");

    expect(cache.get("config", filePath)).toBeUndefined();
  });

  it("invalidates specific key", () => {
    const cache = new PromptCache();
    cache.set("a", "content a", 5);
    cache.set("b", "content b", 5);

    cache.invalidate("a");

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe("content b");
  });

  it("invalidates by pattern", () => {
    const cache = new PromptCache();
    cache.set("system:foo", "x", 1);
    cache.set("system:bar", "y", 1);
    cache.set("user:foo", "z", 1);

    cache.invalidateMatching(/^system:/);

    expect(cache.get("system:foo")).toBeUndefined();
    expect(cache.get("system:bar")).toBeUndefined();
    expect(cache.get("user:foo")).toBe("z");
  });

  it("clears all entries", () => {
    const cache = new PromptCache();
    cache.set("a", "1", 1);
    cache.set("b", "2", 1);
    cache.clear();
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeUndefined();
  });

  it("tracks stats", () => {
    const cache = new PromptCache();
    cache.set("a", "content", 100);
    cache.set("b", "more", 200);

    const stats = cache.getStats();
    expect(stats.entries).toBe(2);
    expect(stats.totalTokens).toBe(300);
  });
});
