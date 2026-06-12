/**
 * Prompt Cache — cache system prompts và NEURO.md giữa các turns.
 *
 * Lưu trong memory với TTL. Cache invalidation dựa trên file mtime.
 */

import { existsSync, statSync } from "node:fs";

interface CacheEntry {
  /** Cached content. */
  content: string;
  /** Cached tokens. */
  tokens: number;
  /** When this was cached. */
  cachedAt: number;
  /** Source file path (for invalidation). */
  sourcePath?: string;
  /** Source mtime (for invalidation). */
  sourceMtime?: number;
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export class PromptCache {
  private cache = new Map<string, CacheEntry>();
  private readonly ttl: number;

  constructor(ttl: number = DEFAULT_TTL) {
    this.ttl = ttl;
  }

  /** Get cached content if valid. */
  get(key: string, sourcePath?: string): string | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (Date.now() - entry.cachedAt > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Check source file invalidation
    if (sourcePath && entry.sourcePath === sourcePath) {
      if (existsSync(sourcePath)) {
        try {
          const mtime = statSync(sourcePath).mtimeMs;
          if (mtime !== entry.sourceMtime) {
            this.cache.delete(key);
            return undefined;
          }
        } catch {
          // ignore
        }
      }
    }

    return entry.content;
  }

  /** Set cache entry. */
  set(key: string, content: string, tokens: number, sourcePath?: string): void {
    const entry: CacheEntry = {
      content,
      tokens,
      cachedAt: Date.now(),
      sourcePath,
      sourceMtime: sourcePath && existsSync(sourcePath)
        ? statSync(sourcePath).mtimeMs
        : undefined,
    };
    this.cache.set(key, entry);
  }

  /** Invalidate a specific key. */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /** Invalidate all entries matching a pattern. */
  invalidateMatching(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /** Clear all cache. */
  clear(): void {
    this.cache.clear();
  }

  /** Get cache stats. */
  getStats(): { entries: number; totalTokens: number; hits: number; misses: number } {
    let totalTokens = 0;
    for (const entry of this.cache.values()) {
      totalTokens += entry.tokens;
    }
    return {
      entries: this.cache.size,
      totalTokens,
      hits: this.hits,
      misses: this.misses,
    };
  }

  private hits = 0;
  private misses = 0;

  /** Track hit/miss for stats. */
  recordHit(): void {
    this.hits++;
  }

  recordMiss(): void {
    this.misses++;
  }
}
