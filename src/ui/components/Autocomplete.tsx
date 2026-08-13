/**
 * Zeno UI v2 — Autocomplete (spec §16, docs/ui/component-spec.md § Input).
 *
 * Renders suggestion rows under the Composer line. No box — plain lines,
 * selected row inverted. Trigger family (/, @, !) is shown as a small prefix
 * label. Renders nothing when there are no suggestions.
 */

import React from "react";
import { Box, Text } from "ink";
import { useUiTheme } from "../theme/provider.js";
import { resolveSymbols } from "../render/markdown.js";
import type { Suggestion, TriggerKind } from "../input/suggestions.js";

export interface AutocompleteProps {
  suggestions: Suggestion[];
  selectedIndex: number;
  trigger: TriggerKind | null;
  unicode: boolean;
}

const TRIGGER_LABEL: Record<TriggerKind, string> = {
  "/": "command",
  "@": "file",
  "!": "shell",
};

export function Autocomplete({
  suggestions,
  selectedIndex,
  trigger,
  unicode,
}: AutocompleteProps): React.JSX.Element | null {
  const theme = useUiTheme();
  const symbols = resolveSymbols(unicode);

  if (suggestions.length === 0) {
    return null;
  }

  const kindLabel = trigger !== null ? TRIGGER_LABEL[trigger] : "";

  return (
    <Box flexDirection="column" marginTop={1}>
      {kindLabel ? (
        <Text color={theme.noColor ? undefined : theme.palette.subtle}>
          {symbols.action} {kindLabel}
        </Text>
      ) : null}
      {suggestions.map((s, i) => {
        const selected = i === selectedIndex;
        return (
          <Text key={s.value} inverse={selected} color={theme.noColor ? undefined : theme.palette.muted}>
            {"  "}
            <Text bold={selected}>{s.label}</Text>
            {s.description ? <Text dimColor>  {s.description}</Text> : null}
          </Text>
        );
      })}
    </Box>
  );
}
