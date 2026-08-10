/**
 * Smart Context Loader — track files đã seen và suggest relevant files.
 *
 * Tracks which files agent has read.
 * Suggests files based on task description.
 * Index-based search cho large codebases.
 */

import { readdirSync, statSync } from "node:fs";
import path from "node:path";

// ---- Types ----

export interface FileIndexEntry {
  /** File path. */
  path: string;
  /** File size in bytes. */
  size: number;
  /** Last modified time. */
  modified: number;
  /** Whether this file has been "seen" by the agent. */
  seen: boolean;
  /** Tags for categorization. */
  tags: string[];
}

export interface SmartContextStats {
  totalFiles: number;
  seenFiles: number;
  totalSize: number;
  seenSize: number;
}

// ---- Smart Context Loader ----

export class SmartContextLoader {
  private index = new Map<string, FileIndexEntry>();
  private seenFiles = new Set<string>();
  private readonly cwd: string;
  private readonly ignore: string[];

  constructor(cwd: string, ignore: string[] = []) {
    this.cwd = cwd;
    this.ignore = ignore;
  }

  /** Build file index by walking directory. */
  buildIndex(maxFiles = 1000): number {
    this.index.clear();
    this.walkDirectory(this.cwd, maxFiles);
    return this.index.size;
  }

  /** Mark a file as seen. */
  markSeen(filePath: string): void {
    const normalized = this.normalize(filePath);
    this.seenFiles.add(normalized);
    // Also update the index entry if it exists
    const entry = this.index.get(normalized);
    if (entry) {
      entry.seen = true;
    }
  }

  /** Get list of seen files. */
  getSeenFiles(): string[] {
    return Array.from(this.seenFiles);
  }

  /** Get list of unseen files. */
  getUnseenFiles(): string[] {
    const result: string[] = [];
    for (const entry of this.index.values()) {
      if (!entry.seen) {
        result.push(entry.path);
      }
    }
    return result;
  }

  /** Get file index entry. */
  getEntry(filePath: string): FileIndexEntry | undefined {
    return this.index.get(this.normalize(filePath));
  }

  /** Suggest files based on task description (simple keyword matching). */
  suggestForTask(task: string, limit = 5): string[] {
    const keywords = this.extractKeywords(task);
    if (keywords.length === 0) return [];

    const scored: Array<{ path: string; score: number }> = [];

    for (const entry of this.index.values()) {
      let score = 0;
      const fileName = path.basename(entry.path).toLowerCase();

      for (const keyword of keywords) {
        if (fileName.includes(keyword.toLowerCase())) {
          score += 3;
        }
        if (entry.path.toLowerCase().includes(keyword.toLowerCase())) {
          score += 1;
        }
      }

      if (score > 0) {
        scored.push({ path: entry.path, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.path);
  }

  /** Get smart context stats. */
  getStats(): SmartContextStats {
    let totalSize = 0;
    let seenSize = 0;
    let seenCount = 0;

    for (const entry of this.index.values()) {
      totalSize += entry.size;
      const isSeen = this.seenFiles.has(this.normalize(entry.path));
      if (isSeen) {
        seenSize += entry.size;
        seenCount++;
      }
    }

    return {
      totalFiles: this.index.size,
      seenFiles: seenCount,
      totalSize,
      seenSize,
    };
  }

  /** Get a summary for display. */
  getSummary(): string {
    const stats = this.getStats();
    const unseenCount = stats.totalFiles - stats.seenFiles;
    return [
      `Files: ${stats.totalFiles} (${stats.seenFiles} seen, ${unseenCount} unseen)`,
      `Size: ${(stats.totalSize / 1024).toFixed(1)}KB total, ${(stats.seenSize / 1024).toFixed(1)}KB seen`,
    ].join("\n");
  }

  // ---- Private ----

  private walkDirectory(dir: string, maxFiles: number): void {
    if (this.index.size >= maxFiles) return;

    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (this.index.size >= maxFiles) return;

      const fullPath = path.join(dir, entry.name);

      if (this.ignore.includes(entry.name)) continue;

      if (entry.isDirectory()) {
        this.walkDirectory(fullPath, maxFiles);
      } else if (entry.isFile()) {
        try {
          const stat = statSync(fullPath);
          this.index.set(this.normalize(fullPath), {
            path: fullPath,
            size: stat.size,
            modified: stat.mtimeMs,
            seen: this.seenFiles.has(this.normalize(fullPath)),
            tags: this.inferTags(entry.name),
          });
        } catch {
          // ignore
        }
      }
    }
  }

  private inferTags(fileName: string): string[] {
    const tags: string[] = [];
    if (/\.test\.|\.spec\./i.test(fileName)) tags.push("test");
    if (/\.config\.|rc\.|conf\./i.test(fileName)) tags.push("config");
    if (/index\.|main\./i.test(fileName)) tags.push("entry");
    if (/ZENO\.md/i.test(fileName)) tags.push("instructions");
    return tags;
  }

  private extractKeywords(task: string): string[] {
    return task
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !this.isStopWord(w));
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      "the", "and", "for", "are", "but", "not", "you", "all", "can",
      "her", "was", "one", "our", "had", "has", "this", "that", "with",
      "from", "they", "been", "have", "their", "than", "what", "when",
    ]);
    return stopWords.has(word);
  }

  private normalize(filePath: string): string {
    return path.resolve(filePath).replace(/\\/g, "/");
  }
}
