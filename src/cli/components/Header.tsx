import React from "react";
import { Box, Text } from "ink";

interface HeaderProps {
  model: string;
  provider: string;
  tokens: number;
}

export function Header({ model, provider, tokens }: HeaderProps): React.JSX.Element {
  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column">
      <Text bold>NeuroCLI</Text>
      <Text color="cyan">
        Model: {model} | Provider: {provider} | Tokens: {tokens}
      </Text>
    </Box>
  );
}
