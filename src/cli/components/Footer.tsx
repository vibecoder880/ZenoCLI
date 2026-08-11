import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../theme.js";

export interface FooterProps {
  isBusy: boolean;
  isMultiLine: boolean;
}

const HINTS: Array<{ keys: string; label: string }> = [
  { keys: "Esc", label: "exit" },
  { keys: "/", label: "commands" },
  { keys: "Shift+Tab", label: "permission" },
  { keys: "Shift+Enter", label: "newline" },
  { keys: "↑↓", label: "history" }
];

export function Footer({ isBusy, isMultiLine }: FooterProps): React.JSX.Element {
  const theme = useTheme();
  return (
    <Box marginTop={1} paddingX={1} flexDirection="row">
      {HINTS.map((hint, index) => (
        <React.Fragment key={hint.keys}>
          {index > 0 ? <Text dimColor> · </Text> : null}
          <Text dimColor>
            <Text color={isMultiLine && hint.keys === "Shift+Enter" ? theme.success : undefined}>
              {hint.keys}
            </Text>
            {" "}
            {hint.label}
          </Text>
        </React.Fragment>
      ))}
      {isBusy ? <Text color={theme.warning}> · busy (Esc to interrupt)</Text> : null}
    </Box>
  );
}
