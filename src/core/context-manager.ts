/**
 * Context Manager — token-aware context window tracking and auto-compaction.
 *
 * Priority for eviction (lowest first):
 *   tool outputs (oldest) → old user messages → old assistant messages
 * Always preserved: system prompt, ZENO.md, memory, current task context
 */

import type { ChatMessage } from "../providers/base.js";

// ---- Types ----

export interface ContextEntry {
  /** Unique id for this entry. */
  id: string;
  /** Role in conversation. */
  role: "system" | "user" | "assistant" | "tool_result";
  /** Text content. */
  content: string;
  /** Estimated token count. */
  tokens: number;
  /** Timestamp when added. */
  timestamp: number;
  /** Is this entry critical (never evicted)? */
  pinned: boolean;
  /** Optional tag for grouping (e.g., "tool_output", "conversation"). */
  tag?: string;
}

export interface ContextStats {
  totalTokens: number;
  maxTokens: number;
  utilizationPercent: number;
  entryCount: number;
  pinnedTokens: number;
  evictableTokens: number;
}

export interface CompactResult {
  compacted: boolean;
  tokensBefore: number;
  tokensAfter: number;
  tokensFreed: number;
  summary?: string;
}

export interface ContextSnapshot {
  entries: ContextEntry[];
  stats: ContextStats;
}

// ---- Estimate ----

/**
 * Rough token estimator: ~4 chars per token for English/code.
 * Not perfect but good enough for eviction decisions.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ---- Context Manager ----

let nextEntryId = 0;

export class ContextManager {
  private entries: ContextEntry[] = [];
  private readonly maxTokens: number;
  private readonly compactThreshold: number;
  private compactionInProgress = false;
  private consecutiveCompactions = 0;

  constructor(maxTokens: number, compactThresholdPercent = 0.8) {
    this.maxTokens = maxTokens;
    this.compactThreshold = Math.floor(maxTokens * compactThresholdPercent);
  }

  /** Add a pinned system entry (never evicted). */
  addSystem(content: string): void {
    this.push({
      role: "system",
      content,
      tokens: estimateTokens(content),
      pinned: true,
      tag: "system",
    });
  }

  /** Add a user message. */
  addUser(content: string, pinned = false): void {
    this.push({
      role: "user",
      content,
      tokens: estimateTokens(content),
      pinned,
      tag: "conversation",
    });
  }

  /** Add an assistant message. */
  addAssistant(content: string): void {
    this.push({
      role: "assistant",
      content,
      tokens: estimateTokens(content),
      pinned: false,
      tag: "conversation",
    });
  }

  /** Add a tool result. */
  addToolResult(toolName: string, content: string): void {
    this.push({
      role: "tool_result",
      content,
      tokens: estimateTokens(content),
      pinned: false,
      tag: "tool_output",
    });
  }

  /** Get total token usage. */
  get totalTokens(): number {
    return this.entries.reduce((sum, e) => sum + e.tokens, 0);
  }

  /** Get context statistics. */
  getStats(): ContextStats {
    const total = this.totalTokens;
    const pinned = this.entries
      .filter((e) => e.pinned)
      .reduce((s, e) => s + e.tokens, 0);
    return {
      totalTokens: total,
      maxTokens: this.maxTokens,
      utilizationPercent: Math.round((total / this.maxTokens) * 100),
      entryCount: this.entries.length,
      pinnedTokens: pinned,
      evictableTokens: total - pinned,
    };
  }

  /** Check if compaction is needed and return result. */
  needsCompaction(): boolean {
    return this.totalTokens >= this.compactThreshold;
  }

  /**
   * Perform compaction: evict oldest tool outputs, then old conversation turns.
   * Returns a summary of what was done.
   */
  compact(): CompactResult {
    if (this.compactionInProgress) {
      return { compacted: false, tokensBefore: this.totalTokens, tokensAfter: this.totalTokens, tokensFreed: 0 };
    }

    const tokensBefore = this.totalTokens;

    // Thrashing protection: if we just compacted and still need it, stop.
    if (this.consecutiveCompactions >= 3) {
      return { compacted: false, tokensBefore, tokensAfter: tokensBefore, tokensFreed: 0 };
    }

    this.compactionInProgress = true;
    try {
      // Phase 1: Evict oldest tool outputs (keep last 2)
      const toolOutputs = this.entries.filter(
        (e) => e.tag === "tool_output" && !e.pinned
      );
      const outputsToEvict = toolOutputs.slice(0, Math.max(0, toolOutputs.length - 2));
      const evictIds = new Set(outputsToEvict.map((e) => e.id));
      this.entries = this.entries.filter((e) => !evictIds.has(e.id));

      // Phase 2: If still over threshold, evict oldest non-pinned conversation turns
      if (this.totalTokens >= this.compactThreshold) {
        const conversationEntries = this.entries.filter(
          (e) => e.tag === "conversation" && !e.pinned
        );
        // Keep the last 4 conversation turns (user + assistant pairs)
        const toEvict = conversationEntries.slice(0, Math.max(0, conversationEntries.length - 8));
        const convEvictIds = new Set(toEvict.map((e) => e.id));
        this.entries = this.entries.filter((e) => !convEvictIds.has(e.id));
      }

      const tokensAfter = this.totalTokens;
      const tokensFreed = tokensBefore - tokensAfter;
      this.consecutiveCompactions = tokensFreed > 0 ? 0 : this.consecutiveCompactions + 1;

      return {
        compacted: tokensFreed > 0,
        tokensBefore,
        tokensAfter,
        tokensFreed,
      };
    } finally {
      this.compactionInProgress = false;
    }
  }

  /** Reset consecutive compaction counter (call when user sends new message). */
  resetCompactionCounter(): void {
    this.consecutiveCompactions = 0;
  }

  /** Convert entries to ChatMessage[] for provider API calls. */
  toMessages(): ChatMessage[] {
    return this.entries.map((e) => ({
      role: e.role === "tool_result" ? "user" : e.role,
      content: e.content,
    }));
  }

  /** Take a snapshot of current state. */
  snapshot(): ContextSnapshot {
    return {
      entries: [...this.entries],
      stats: this.getStats(),
    };
  }

  /** Get a summary for /context command. */
  getSummary(): string {
    const stats = this.getStats();
    const byTag = new Map<string, { count: number; tokens: number }>();
    for (const entry of this.entries) {
      const tag = entry.tag ?? "other";
      const current = byTag.get(tag) ?? { count: 0, tokens: 0 };
      byTag.set(tag, { count: current.count + 1, tokens: current.tokens + entry.tokens });
    }

    const lines = [
      `Context: ${stats.utilizationPercent}% (${stats.totalTokens.toLocaleString()} / ${stats.maxTokens.toLocaleString()} tokens)`,
      `Entries: ${stats.entryCount} (${stats.pinnedTokens.toLocaleString()} pinned, ${stats.evictableTokens.toLocaleString()} evictable)`,
    ];

    for (const [tag, data] of byTag) {
      lines.push(`  ${tag}: ${data.count} entries, ${data.tokens.toLocaleString()} tokens`);
    }

    return lines.join("\n");
  }

  // ---- Private ----

  private push(entry: Omit<ContextEntry, "id" | "timestamp">): void {
    this.entries.push({
      ...entry,
      id: `ctx_${nextEntryId++}`,
      timestamp: Date.now(),
    });
  }
}
