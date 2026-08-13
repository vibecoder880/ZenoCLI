/**
 * Zeno UI v2 — Input (spec §16, docs/ui/component-spec.md § Input / Composer).
 *
 * The semantic `›` prompt prefix. Phase 4 replaces this with the full Composer
 * (text / slash / @file / !shell, autocomplete, history, multiline).
 */

import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { useUiTheme } from "../theme/provider.js";
import { resolveSymbols } from "../render/markdown.js";

export interface InputProps {
  value: string;
  placeholder: string;
  disabled?: boolean;
  unicode: boolean;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

export function Input({
  value,
  placeholder,
  disabled = false,
  unicode,
  onChange,
  onSubmit,
}: InputProps): React.JSX.Element {
  const theme = useUiTheme();
  const symbols = resolveSymbols(unicode);
  return (
    <Box marginTop={1}>
      <Text bold color={theme.noColor ? undefined : theme.palette.accent}>
        {symbols.user}{" "}
      </Text>
      <TextInput
        value={value}
        placeholder={placeholder}
        focus={!disabled}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    </Box>
  );
}