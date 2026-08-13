/**
 * Zeno UI v2 — Activity engine types (Phase 5, spec §30).
 *
 * Replaces the raw tool-log with aggregated operational status lines.
 * Supports progressive disclosure: a collapsed summary line expands on Enter
 * to show file lists, full output, etc.
 */

import type { AgentEvent } from "../../agent/loop.js";

/** A single operational line in the activity stream. */
export interface ActivityLine {
  /** Unique key for React. */
  id: string;
  /** Tool name this line represents (e.g., "read_file", "edit_file"). */
  toolName: string;
  /** Collapsed one-line summary (e.g., "✓ Read 4 files"). */
  summary: string;
  /** Full detail shown when expanded (file list, diff, etc.). */
  detail?: string;
  /** Whether the line is currently expanded. */
  expanded: boolean;
  /** Final status when the tool batch completes: "ok" | "error" | "running". */
  status: "ok" | "error" | "running";
  /** Timestamp for ordering. */
  timestamp: number;
}

/**
 * Aggregates AgentEvents into ActivityLines.
 *
 * Rules:
 * - tool_start: marks a new tool invocation as "running".
 * - tool_result: completes the line, sets summary/detail.
 * - Multiple tool_result for the same toolName are merged into one line
 *   (e.g., multiple read_file calls → "✓ Read 4 files" with a file list in detail).
 * - Error tool_result marks status "error".
 */
export class ActivityAggregator {
  private lines: Map<string, ActivityLine> = new Map();
  private order: string[] = [];

  /** Process an AgentEvent; returns the updated list of ActivityLines. */
  process(event: AgentEvent): ActivityLine[] {
    switch (event.type) {
      case "tool_start":
        return this.onToolStart(event);
      case "tool_result":
        return this.onToolResult(event);
      case "error":
        return this.onError(event);
      default:
        return this.getLines();
    }
  }

  private onToolStart(event: AgentEvent): ActivityLine[] {
    if (!event.toolName) {
      return this.getLines();
    }
    // If there's already a running line for this tool, keep it (batched).
    const existing = this.lines.get(event.toolName);
    if (existing && existing.status === "running") {
      return this.getLines();
    }
    const id = `${event.toolName}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const line: ActivityLine = {
      id,
      toolName: event.toolName,
      summary: `● ${event.toolName}`,
      detail: undefined,
      expanded: false,
      status: "running",
      timestamp: Date.now(),
    };
    this.lines.set(event.toolName, line);
    if (!this.order.includes(event.toolName)) {
      this.order.push(event.toolName);
    }
    return this.getLines();
  }

  private onToolResult(event: AgentEvent): ActivityLine[] {
    if (!event.toolName) {
      return this.getLines();
    }
    const existing = this.lines.get(event.toolName);
    const isError = event.content.toLowerCase().includes("error") || event.content.startsWith("✗");

    if (existing) {
      // Merge into existing line.
      const count = this.extractCount(existing.detail) + 1;
      const files = this.extractFiles(event.content);
      const allFiles = existing.detail ? this.extractFiles(existing.detail).concat(files) : files;

      existing.summary = isError
        ? `× ${event.toolName} failed`
        : `✓ ${event.toolName} (${count})`;
      existing.detail = allFiles.length > 0 ? allFiles.join("\n") : undefined;
      existing.status = isError ? "error" : "ok";
      existing.expanded = false;
    } else {
      // First result for this tool (no start event seen).
      const files = this.extractFiles(event.content);
      const count = files.length || 1;
      const id = `${event.toolName}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      this.lines.set(event.toolName, {
        id,
        toolName: event.toolName,
        summary: isError ? `× ${event.toolName} failed` : `✓ ${event.toolName} (${count})`,
        detail: files.length > 0 ? files.join("\n") : undefined,
        expanded: false,
        status: isError ? "error" : "ok",
        timestamp: Date.now(),
      });
      this.order.push(event.toolName);
    }
    return this.getLines();
  }

  private onError(event: AgentEvent): ActivityLine[] {
    const toolName = event.toolName ?? "error";
    const id = `${toolName}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    this.lines.set(toolName, {
      id,
      toolName,
      summary: `× ${toolName} error`,
      detail: event.content,
      expanded: true,
      status: "error",
      timestamp: Date.now(),
    });
    if (!this.order.includes(toolName)) {
      this.order.push(toolName);
    }
    return this.getLines();
  }

  /** Get current lines in invocation order. */
  getLines(): ActivityLine[] {
    return this.order
      .map((toolName) => this.lines.get(toolName))
      .filter((l): l is ActivityLine => l !== undefined);
  }

  /** Toggle expanded state of a line by toolName. */
  toggle(toolName: string): ActivityLine[] {
    const line = this.lines.get(toolName);
    if (line) {
      line.expanded = !line.expanded;
    }
    return this.getLines();
  }

  /** Clear all activity (e.g., on new turn). */
  clear(): void {
    this.lines.clear();
    this.order = [];
  }

  private extractCount(detail?: string): number {
    if (!detail) return 0;
    // Rough count of files in detail.
    return detail.split("\n").length;
  }

  private extractFiles(content: string): string[] {
    // Extract file paths from typical tool output patterns.
    const matches = content.match(/(?:^|\s)([\w/.-]+\.(?:ts|tsx|js|jsx|json|md|py|rs|go|toml|yml|yaml))(?=\s|$)/g);
    return matches ?? [];
  }
}

export function createActivityAggregator(): ActivityAggregator {
  return new ActivityAggregator();
}