import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface PromptProps {
  value: string;
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

export function Prompt({
  value,
  placeholder,
  disabled = false,
  onChange,
  onSubmit
}: PromptProps): React.JSX.Element {
  return (
    <Box marginTop={1}>
      <Text>{"> "}</Text>
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
