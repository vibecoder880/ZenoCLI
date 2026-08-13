/**
 * Zeno UI v2 — Composer history (docs/ui/keyboard.md § Composer).
 *
 * A small, pure ring buffer for prompt navigation (Up/Down on an empty or
 * partially-typed input recalls prior prompts). Session-scoped; not persisted
 * to disk (matches the v1 behavior of a per-launch history).
 */

export class PromptHistory {
  private entries: string[] = [];
  private index = -1;

  constructor(private readonly max = 100) {}

  /** Add a submitted prompt to the top of the stack (dedupes consecutive). */
  push(value: string): void {
    const trimmed = value.trim();
    if (trimmed === "") {
      return;
    }
    if (this.entries[0] === trimmed) {
      return;
    }
    this.entries.unshift(trimmed);
    if (this.entries.length > this.max) {
      this.entries.length = this.max;
    }
  }

  /** Move through history; returns the recalled value or null at the end. */
  navigate(direction: "up" | "down"): string | null {
    if (this.entries.length === 0) {
      return null;
    }
    if (direction === "up") {
      this.index = Math.min(this.index + 1, this.entries.length - 1);
    } else {
      this.index = Math.max(this.index - 1, -1);
    }
    return this.index >= 0 ? this.entries[this.index] : null;
  }

  /** Reset the navigation cursor (call after editing the input manually). */
  reset(): void {
    this.index = -1;
  }

  get size(): number {
    return this.entries.length;
  }
}
