/**
 * Zeno UI v2 — DiffBlock (Phase 7, spec §31, docs/ui/component-spec.md § DiffBlock).
 *
 * Inline, borderless diff viewer. Shows file headers, summary stats,
 * and color-coded +/- lines. Supports file navigation (Up/Down) and
 * accept/reject per file.
 */

import React from "react";
import { Box, Text } from "ink";
import { useUiTheme, type ResolvedTheme } from "../theme/provider.js";
import { resolveSymbols } from "../render/markdown.js";
import { parseDiff, diffSummary, type DiffStats, type DiffFile } from "../render/diff-parse.js";

export interface DiffBlockProps {
  /** Raw unified diff text. */
  diffText: string;
  unicode: boolean;
  /** Index of the currently focused file (for navigation). */
  focusedFileIndex?: number;
  /** Called when user navigates files (Up/Down). */
  onNavigate?: (index: number) => void;
  /** Called when user accepts a file's changes. */
  onAccept?: (fileIndex: number) => void;
  /** Called when user rejects a file's changes. */
  onReject?: (fileIndex: number) => void;
}

function DiffHunkLine({
  line,
  theme,
}: {
  line: { type: string; content: string };
  theme: ResolvedTheme;
}): React.JSX.Element {
  const color = theme.noColor
    ? undefined
    : line.type === "add"
      ? theme.palette.success
      : line.type === "remove"
        ? theme.palette.error
        : line.type === "hunk"
          ? theme.palette.accent
          : theme.palette.subtle;

  return (
    <Text color={color}>
      {line.content}
    </Text>
  );
}

function DiffFileBlock({
  file,
  index,
  focused,
  unicode,
  theme,
}: {
  file: DiffFile;
  index: number;
  focused: boolean;
  unicode: boolean;
  theme: ResolvedTheme;
}): React.JSX.Element {
  const symbols = resolveSymbols(unicode);
  const indicator = focused ? symbols.active : " ";

  return (
    <Box flexDirection="column">
      <Text
        bold={focused}
        color={theme.noColor ? undefined : (focused ? theme.palette.accent : theme.palette.muted)}
      >
        {"  "}{indicator} {file.path}
        {"  "}
        <Text color={theme.noColor ? undefined : theme.palette.success}>+{file.added}</Text>
        {" "}
        <Text color={theme.noColor ? undefined : theme.palette.error}>−{file.removed}</Text>
      </Text>
      {file.hunks.map((hunk, hi) => (
        <Box key={hi} flexDirection="column" marginLeft={2}>
          <DiffHunkLine line={{ type: "hunk", content: hunk.header }} theme={theme} />
          {hunk.lines.map((line, li) => (
            <DiffHunkLine key={li} line={line} theme={theme} />
          ))}
        </Box>
      ))}
    </Box>
  );
}

export function DiffBlock({
  diffText,
  unicode,
  focusedFileIndex = 0,
}: DiffBlockProps): React.JSX.Element | null {
  const theme = useUiTheme();
  const stats = parseDiff(diffText);

  if (stats.files.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginLeft={2}>
      <Text color={theme.noColor ? undefined : theme.palette.muted}>
        {diffSummary(stats)}
      </Text>
      {stats.files.map((file, i) => (
        <DiffFileBlock
          key={file.path}
          file={file}
          index={i}
          focused={i === focusedFileIndex}
          unicode={unicode}
          theme={theme}
        />
      ))}
    </Box>
  );
}
