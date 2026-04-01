import React from "react";
import { Box, Text } from "ink";
import type { SlashCommand } from "../slash-commands.js";

interface SlashMenuProps {
  commands: SlashCommand[];
  selectedIndex: number;
}

export function SlashMenu({ commands, selectedIndex }: SlashMenuProps): React.JSX.Element | null {
  if (commands.length === 0) {
    return null;
  }

  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column" marginTop={1}>
      {commands.map((entry, index) => (
        <Text key={entry.command} inverse={index === selectedIndex}>
          {entry.command.padEnd(10, " ")} {entry.description}
        </Text>
      ))}
    </Box>
  );
}
