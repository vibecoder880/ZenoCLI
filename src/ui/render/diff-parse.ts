/**
 * Zeno UI v2 — Diff parser (Phase 7, spec §31, docs/ui/component-spec.md § DiffBlock).
 *
 * Parses unified diff text into structured file blocks with hunk metadata.
 * Pure functions only (no React/Ink).
 */

export interface DiffLine {
  type: "context" | "add" | "remove" | "hunk" | "file-header";
  content: string;
}

export interface DiffHunk {
  header: string;     // @@ -oldLine,oldCount +newLine,newCount @@
  lines: DiffLine[];
}

export interface DiffFile {
  path: string;
  hunks: DiffHunk[];
  added: number;
  removed: number;
}

export interface DiffStats {
  files: DiffFile[];
  totalAdded: number;
  totalRemoved: number;
}

/** Parse a unified diff string into structured DiffStats. */
export function parseDiff(text: string): DiffStats {
  const lines = text.split("\n");
  const files: DiffFile[] = [];
  let currentFile: DiffFile | null = null;
  let currentHunk: DiffHunk | null = null;

  for (const line of lines) {
    // File header: "diff --git a/path b/path" or "--- a/path" / "+++ b/path"
    if (line.startsWith("diff --git ")) {
      // Save previous file/hunk
      if (currentHunk && currentFile) {
        currentFile.hunks.push(currentHunk);
        currentHunk = null;
      }
      if (currentFile) {
        files.push(currentFile);
      }
      // Extract path from "diff --git a/path b/path"
      const match = /diff --git a\/(.+?) b\//.exec(line);
      const path = match ? match[1] : line.slice(11);
      currentFile = { path, hunks: [], added: 0, removed: 0 };
      continue;
    }

    // +++ b/path — use as file path if we didn't get it from diff --git
    if (line.startsWith("+++ b/")) {
      if (!currentFile) {
        currentFile = { path: line.slice(6), hunks: [], added: 0, removed: 0 };
      }
      continue;
    }

    // --- a/path — skip
    if (line.startsWith("--- a/")) {
      continue;
    }

    // Hunk header: @@ -oldLine,oldCount +newLine,newCount @@
    const hunkMatch = /^(@@.+@@)(.*)$/.exec(line);
    if (hunkMatch) {
      if (currentHunk && currentFile) {
        currentFile.hunks.push(currentHunk);
      }
      currentHunk = { header: hunkMatch[1].trim(), lines: [] };
      continue;
    }

    // Diff lines
    if (currentHunk) {
      if (line.startsWith("+")) {
        currentHunk.lines.push({ type: "add", content: line });
        if (currentFile) currentFile.added++;
      } else if (line.startsWith("-")) {
        currentHunk.lines.push({ type: "remove", content: line });
        if (currentFile) currentFile.removed++;
      } else if (line.startsWith(" ")) {
        currentHunk.lines.push({ type: "context", content: line });
      } else if (line === "") {
        // Empty line in diff — treat as context
        currentHunk.lines.push({ type: "context", content: " " });
      }
    }
  }

  // Flush remaining
  if (currentHunk && currentFile) {
    currentFile.hunks.push(currentHunk);
  }
  if (currentFile) {
    files.push(currentFile);
  }

  const totalAdded = files.reduce((s, f) => s + f.added, 0);
  const totalRemoved = files.reduce((s, f) => s + f.removed, 0);

  return { files, totalAdded, totalRemoved };
}

/** Summary line: "3 files changed · +42 −11" */
export function diffSummary(stats: DiffStats): string {
  const fileCount = stats.files.length;
  if (fileCount === 0) return "No changes";
  const fileWord = fileCount === 1 ? "file" : "files";
  return `${fileCount} ${fileWord} changed · +${stats.totalAdded} −${stats.totalRemoved}`;
}
