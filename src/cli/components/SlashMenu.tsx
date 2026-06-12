import React from "react";
import { Box, Text } from "ink";
import {
  getSlashCommandsByCategory,
  SLASH_CATEGORY_LABELS,
  type SlashCommand,
  type SlashCommandCategory
} from "../slash-commands.js";

interface SlashMenuProps {
  commands: SlashCommand[];
  selectedIndex: number;
}

const CATEGORY_ORDER: SlashCommandCategory[] = ["mode", "session", "debug", "info"];

export function SlashMenu({ commands, selectedIndex }: SlashMenuProps): React.JSX.Element | null {
  if (commands.length === 0) {
    return null;
  }

  // Build a flat list of (command, globalIndex) for selection highlight.
  const grouped = getSlashCommandsByCategory();
  const flat: SlashCommand[] = [];
  const order: SlashCommand[] = [];
  for (const category of CATEGORY_ORDER) {
    const inCategory = commands.filter((c) => c.category === category);
    if (inCategory.length === 0) continue;
    for (const c of inCategory) {
      order.push(c);
      flat.push(c);
    }
    grouped[category] = inCategory;
  }
  void grouped; // satisfies grouped variable usage

  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column" marginTop={1}>
      {CATEGORY_ORDER.map((category) => {
        const items = commands.filter((c) => c.category === category);
        if (items.length === 0) return null;
        return (
          <Box key={category} flexDirection="column" marginBottom={1}>
            <Text dimColor bold>
              {SLASH_CATEGORY_LABELS[category]}
            </Text>
            {items.map((entry) => {
              const idx = flat.indexOf(entry);
              const isSelected = idx === selectedIndex;
              return (
                <Text key={entry.command} inverse={isSelected}>
                  {"  "}
                  {entry.command.padEnd(12, " ")} {entry.description}
                </Text>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
}
