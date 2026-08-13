/**
 * Zeno UI v2 — TaskBlock (Phase 6, spec §31, docs/ui/component-spec.md § TaskBlock).
 *
 * Inline plan/task blocks, not cards. Shows a list of items with status
 * indicators:
 *   ✓ done
 *   ● in-progress
 *   ○ pending
 *
 * Collapsed: `Plan · 3/5 complete`. Expanded: shows all items.
 */

import React from "react";
import { Box, Text } from "ink";
import { useUiTheme, type ResolvedTheme } from "../theme/provider.js";
import { resolveSymbols } from "../render/markdown.js";

export type TaskStatus = "done" | "active" | "pending";

export interface TaskItem {
  id: string;
  label: string;
  status: TaskStatus;
}

export interface TaskBlockProps {
  /** Block title (e.g., "Plan"). */
  title: string;
  items: TaskItem[];
  /** When true, shows all items. When false, shows collapsed summary. */
  expanded?: boolean;
  unicode: boolean;
  /** Called when the block is toggled (Enter key). */
  onToggle?: () => void;
}

function statusSymbol(status: TaskStatus, unicode: boolean): string {
  const symbols = resolveSymbols(unicode);
  switch (status) {
    case "done":
      return symbols.success;
    case "active":
      return symbols.active;
    case "pending":
      return symbols.pending;
  }
}

function TaskItemComponent({
  item,
  unicode,
  theme,
}: {
  item: TaskItem;
  unicode: boolean;
  theme: ResolvedTheme;
}): React.JSX.Element {
  const symbol = statusSymbol(item.status, unicode);
  const color = theme.noColor
    ? undefined
    : item.status === "done"
      ? theme.palette.success
      : item.status === "active"
        ? theme.palette.accent
        : theme.palette.subtle;

  return (
    <Text color={color}>
      {"  "}
      {symbol} {item.label}
    </Text>
  );
}

export function TaskBlock({
  title,
  items,
  expanded = false,
  unicode,
}: TaskBlockProps): React.JSX.Element | null {
  const theme = useUiTheme();
  const doneCount = items.filter((i) => i.status === "done").length;
  const activeCount = items.filter((i) => i.status === "active").length;

  if (items.length === 0) {
    return null;
  }

  // Collapsed summary line
  if (!expanded) {
    return (
      <Box flexDirection="column" marginLeft={2}>
        <Text color={theme.noColor ? undefined : theme.palette.muted}>
          {title} · {doneCount}/{items.length} complete
          {activeCount > 0 ? " (in progress)" : ""}
        </Text>
      </Box>
    );
  }

  // Expanded: show all items
  return (
    <Box flexDirection="column" marginLeft={2}>
      <Text bold color={theme.noColor ? undefined : theme.palette.text}>
        {title}
      </Text>
      {items.map((item) => (
        <TaskItemComponent key={item.id} item={item} unicode={unicode} theme={theme} />
      ))}
    </Box>
  );
}

/**
 * Helper to create TaskItem from simple label + status.
 */
export function createTaskItem(id: string, label: string, status: TaskStatus): TaskItem {
  return { id, label, status };
}
