/**
 * Zeno UI v2 — OverlayLayer (Phase 8, spec §31, docs/ui/component-spec.md § OverlayLayer).
 *
 * Unified overlay system: command palette, model picker, theme picker,
 * permission prompt, session picker, help. Small, transient, Esc closes.
 * No ASCII boxes — just text with selection highlight.
 */

import React from "react";
import { Box, Text } from "ink";
import { useUiTheme } from "../theme/provider.js";
import { resolveSymbols } from "../render/markdown.js";
import type { OverlayState } from "../state/overlay-manager.js";

export interface OverlayLayerProps {
  overlay: OverlayState;
  unicode: boolean;
  /** Called when user confirms a selection. */
  onSelect?: (index: number) => void;
  /** Called when user presses Esc to close. */
  onClose?: () => void;
}

export function OverlayLayer({
  overlay,
  unicode,
  onSelect: _onSelect,
  onClose: _onClose,
}: OverlayLayerProps): React.JSX.Element | null {
  const theme = useUiTheme();

  if (!overlay) {
    return null;
  }

  const symbols = resolveSymbols(unicode);

  // Permission prompt has a special layout
  if (overlay.kind === "permission") {
    return (
      <Box flexDirection="column" marginLeft={2} marginTop={1}>
        {overlay.title ? (
          <Text bold color={theme.noColor ? undefined : theme.palette.text}>
            {overlay.title}
          </Text>
        ) : null}
        {overlay.items.map((item, i) => (
          <Text key={i} color={theme.noColor ? undefined : theme.palette.muted}>
            {item}
          </Text>
        ))}
        <Text color={theme.noColor ? undefined : theme.palette.subtle}>
          Enter Allow · a Always allow · d Deny · e Edit policy
        </Text>
      </Box>
    );
  }

  // Standard list overlay (palette, model, theme, session, file, help)
  return (
    <Box flexDirection="column" marginLeft={2} marginTop={1}>
      {overlay.title ? (
        <Text bold color={theme.noColor ? undefined : theme.palette.text}>
          {overlay.title}
        </Text>
      ) : null}
      {overlay.items.map((item, i) => {
        const isSelected = i === overlay.selectedIndex;
        const prefix = isSelected ? `${symbols.active} ` : "  ";
        return (
          <Text
            key={i}
            bold={isSelected}
            color={
              theme.noColor
                ? undefined
                : isSelected
                  ? theme.palette.accent
                  : theme.palette.muted
            }
          >
            {prefix}{item}
          </Text>
        );
      })}
    </Box>
  );
}
