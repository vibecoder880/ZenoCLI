/**
 * Zeno UI v2 — Activity (Phase 5, spec §30, docs/ui/component-spec.md § Activity).
 *
 * Renders aggregated operational status lines in the Conversation area.
 * Replaces raw tool logs with quiet lines:
 *   Reading 4 files…
 *   ✓ Read 4 files        ← collapsed by default
 *   src/auth.ts           ← expanded on Enter
 *   src/token.ts
 *
 * Progressive disclosure: Enter on a collapsed line toggles detail.
 */

import React from "react";
import { Box, Text } from "ink";
import { useUiTheme } from "../theme/provider.js";
import { resolveSymbols } from "../render/markdown.js";
import type { ActivityLine } from "../activity/types.js";

export interface ActivityProps {
  lines: ActivityLine[];
  /** Currently focused line index (for Enter to expand). */
  focusedIndex?: number;
  unicode: boolean;
}

function ActivityLineComponent({
  line,
  isFocused,
  unicode,
  theme,
}: {
  line: ActivityLine;
  isFocused: boolean;
  unicode: boolean;
  theme: ReturnType<typeof useUiTheme>;
}): React.JSX.Element {
  const symbols = resolveSymbols(unicode);

  // Status glyph
  let glyph = symbols.pending;
  if (line.status === "ok") glyph = symbols.success;
  else if (line.status === "error") glyph = symbols.error;

  // Collapsed: summary only. Expanded: summary + detail.
  const isExpanded = line.expanded;

  return (
    <Box flexDirection="column" marginLeft={2}>
      <Text
        color={
          theme.noColor
            ? undefined
            : line.status === "error"
              ? theme.palette.error
              : theme.palette.muted
        }
        bold={isFocused}
        inverse={isFocused && isExpanded}
      >
        {glyph} {line.summary}
      </Text>
      {isExpanded && line.detail ? (
        <Box marginLeft={2} flexDirection="column">
          {line.detail.split("\n").map((file, i) => (
            <Text key={i} color={theme.noColor ? undefined : theme.palette.subtle}>
              {file}
            </Text>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

export function Activity({
  lines,
  focusedIndex = -1,
  unicode,
}: ActivityProps): React.JSX.Element | null {
  const theme = useUiTheme();

  if (lines.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      {lines.map((line, i) => (
        <ActivityLineComponent
          key={line.id}
          line={line}
          isFocused={i === focusedIndex}
          unicode={unicode}
          theme={theme}
        />
      ))}
    </Box>
  );
}