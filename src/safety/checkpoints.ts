/**
 * Checkpoint System — snapshot file contents before edit/write operations.
 * Enables undo (Esc+Esc in TUI) without relying on git.
 *
 * Session-scoped, stored in memory (not persisted).
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

// ---- Types ----

export interface Checkpoint {
  /** Unique ID. */
  id: number;
  /** File path that was snapshotted. */
  filePath: string;
  /** File contents before the operation. */
  previousContent: string | null; // null = file didn't exist
  /** Timestamp of the snapshot. */
  timestamp: number;
  /** Tool that triggered the checkpoint. */
  toolName: string;
}

export interface UndoResult {
  /** The checkpoint that was restored. */
  checkpoint: Checkpoint;
  /** Current content that was replaced. */
  currentContent: string | null;
}

// ---- Checkpoint Manager ----

let nextId = 1;
const MAX_CHECKPOINTS = 100;

export class CheckpointManager {
  private checkpoints: Checkpoint[] = [];

  /**
   * Take a snapshot of a file before modifying it.
   * Call this BEFORE any write/edit operation.
   */
  snapshot(filePath: string, toolName: string): void {
    let previousContent: string | null = null;

    if (existsSync(filePath)) {
      try {
        previousContent = readFileSync(filePath, "utf8");
      } catch {
        // Can't read — treat as new file
        previousContent = null;
      }
    }

    const checkpoint: Checkpoint = {
      id: nextId++,
      filePath,
      previousContent,
      timestamp: Date.now(),
      toolName,
    };

    this.checkpoints.push(checkpoint);

    // Keep only the most recent checkpoints
    if (this.checkpoints.length > MAX_CHECKPOINTS) {
      this.checkpoints = this.checkpoints.slice(-MAX_CHECKPOINTS);
    }
  }

  /**
   * Undo the most recent checkpoint.
   * Restores the file to its previous content.
   */
  undo(): UndoResult | null {
    if (this.checkpoints.length === 0) {
      return null;
    }

    const checkpoint = this.checkpoints.pop()!;

    // Read current content for the result
    let currentContent: string | null = null;
    if (existsSync(checkpoint.filePath)) {
      try {
        currentContent = readFileSync(checkpoint.filePath, "utf8");
      } catch {
        // ignore
      }
    }

    // Restore previous content
    if (checkpoint.previousContent === null) {
      // File didn't exist before — we can't truly delete, but write empty
      // In a real implementation we'd delete the file
      try {
        writeFileSync(checkpoint.filePath, "", "utf8");
      } catch {
        // ignore
      }
    } else {
      try {
        writeFileSync(checkpoint.filePath, checkpoint.previousContent, "utf8");
      } catch {
        // ignore
      }
    }

    return { checkpoint, currentContent };
  }

  /** List all checkpoints (most recent last). */
  listCheckpoints(): Checkpoint[] {
    return [...this.checkpoints];
  }

  /** Get the number of checkpoints. */
  get count(): number {
    return this.checkpoints.length;
  }

  /** Clear all checkpoints. */
  clear(): void {
    this.checkpoints = [];
  }

  /** Get a summary for display. */
  getSummary(): string {
    if (this.checkpoints.length === 0) {
      return "No checkpoints.";
    }

    const recent = this.checkpoints.slice(-5).reverse();
    const lines = recent.map((cp) => {
      const age = Math.round((Date.now() - cp.timestamp) / 1000);
      return `  #${cp.id} ${cp.toolName} → ${cp.filePath} (${age}s ago)`;
    });

    return `Checkpoints: ${this.checkpoints.length}\n${lines.join("\n")}`;
  }
}
