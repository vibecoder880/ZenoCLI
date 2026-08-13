/**
 * Zeno UI v2 — Composer (spec §16, docs/ui/keyboard.md § Composer).
 *
 * The v2 input. Unlike the v1 Prompt (single-line ink-text-input), the Composer
 * owns its input handling so it can support the full keyboard surface:
 *
 *   - multiline input (Shift+Enter inserts a newline),
 *   - trigger autocomplete (/, @, !) with suggestions under the line,
 *   - Up/Down history navigation when no suggestion list is open,
 *   - Tab to accept the highlighted suggestion.
 *
 * The cursor is drawn as `▍` (or `|` when Unicode is unavailable) at the end of
 * the value. Placeholder text shows muted when empty. Nothing is boxed.
 */

import React, { useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { useUiTheme } from "../theme/provider.js";
import { resolveSymbols } from "../render/markdown.js";
import {
  applySuggestion,
  filterSuggestions,
  parseTrigger,
  type Suggestion,
  type Trigger as TriggerInfo,
} from "../input/suggestions.js";
import { PromptHistory } from "../input/history.js";
import { Autocomplete } from "./Autocomplete.js";

export interface ComposerProps {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  unicode: boolean;
  /** Workspace root used for @ file suggestions. */
  cwd: string;
  onChange: (value: string) => void;
  /** Fired on Enter with the final value (already trimmed by the shell). */
  onSubmit: (value: string) => void;
}

export function Composer({
  value,
  placeholder = "",
  disabled = false,
  unicode,
  cwd,
  onChange,
  onSubmit,
}: ComposerProps): React.JSX.Element {
  const theme = useUiTheme();
  const symbols = resolveSymbols(unicode);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [trigger, setTrigger] = useState<TriggerInfo | null>(null);
  const historyRef = useRef<PromptHistory>(new PromptHistory());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const valueRef = useRef(value);
  valueRef.current = value;

  // Recompute suggestions whenever the value changes.
  useEffect(() => {
    const trig = parseTrigger(value);
    setTrigger(trig);
    if (trig === null || disabled) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    void filterSuggestions(trig, cwd).then((list) => {
      if (cancelled) return;
      setSuggestions(list);
      setSelectedIndex(0);
    });
    return () => {
      cancelled = true;
    };
  }, [value, cwd, disabled]);

  // Accept a suggestion: replace the token and keep the composer focused.
  const accept = (index: number): void => {
    const s = suggestions[index];
    if (s === undefined) {
      return;
    }
    onChangeRef.current(applySuggestion(valueRef.current, s));
    setSuggestions([]);
  };

  useInput((inputChar, key) => {
    if (disabled) {
      return;
    }

    // Submit on Enter (no shift).
    if (key.return === true && key.shift !== true) {
      const next = valueRef.current;
      if (next.trim() !== "") {
        onSubmitRef.current(next);
      }
      return;
    }

    // Shift+Enter: insert a newline (multiline).
    if (key.return === true && key.shift === true) {
      onChangeRef.current(valueRef.current + "\n");
      return;
    }

    // Esc: nothing in the composer (interrupt is handled by the shell).
    if (key.escape) {
      return;
    }

    // Tab: accept the highlighted suggestion when a list is open.
    if (key.tab === true && key.shift !== true) {
      if (suggestions.length > 0) {
        accept(selectedIndex);
      }
      return;
    }

    // Up/Down: navigate suggestions, or history when the list is closed
    // (or the input is at a history-neutral position).
    if (key.upArrow === true && !key.ctrl) {
      if (suggestions.length > 0) {
        setSelectedIndex((i) => (i === 0 ? suggestions.length - 1 : i - 1));
      } else {
        const recalled = historyRef.current.navigate("up");
        if (recalled !== null) {
          onChangeRef.current(recalled);
        }
      }
      return;
    }
    if (key.downArrow === true && !key.ctrl) {
      if (suggestions.length > 0) {
        setSelectedIndex((i) => (i === suggestions.length - 1 ? 0 : i + 1));
      } else {
        const recalled = historyRef.current.navigate("down");
        if (recalled !== null) {
          onChangeRef.current(recalled);
        }
      }
      return;
    }

    // Ordinary text / backspace / arrows edit the value directly.
    if (inputChar) {
      onChangeRef.current(valueRef.current + inputChar);
    } else if (key.backspace) {
      onChangeRef.current(valueRef.current.replace(/.$/, ""));
    } else if (key.leftArrow && !key.ctrl) {
      // Left/right arrow editing is intentionally minimal; the cursor lives at
      // the end of the line. Full cursor movement is a later-phase polish item.
      void null;
    } else if (key.rightArrow && !key.ctrl) {
      void null;
    }
  });

  const cursor = unicode ? "▍" : "|";
  const showPlaceholder = value === "";

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text bold color={theme.noColor ? undefined : theme.palette.accent}>
          {symbols.user}{" "}
        </Text>
        {showPlaceholder && !disabled ? (
          <Text color={theme.noColor ? undefined : theme.palette.subtle}>{placeholder}</Text>
        ) : (
          <Text color={theme.noColor ? undefined : theme.palette.text}>
            {value.split("\n").map((line, i, arr) => (
              <React.Fragment key={i}>
                {line}
                {i < arr.length - 1 ? "\n" : null}
              </React.Fragment>
            ))}
            <Text color={theme.noColor ? undefined : theme.palette.subtle}>{cursor}</Text>
          </Text>
        )}
      </Box>
      <Autocomplete
        suggestions={suggestions}
        selectedIndex={selectedIndex}
        trigger={trigger?.kind ?? null}
        unicode={unicode}
      />
    </Box>
  );
}