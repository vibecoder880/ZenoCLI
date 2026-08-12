import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../theme.js";

interface AgentStatusProps {
  lines: string[];
  maxVisible?: number;
}

const EVENT_PATTERNS: Array<{ test: (line: string) => boolean; color: string }> = [
  { test: (line) => line.startsWith("✗") || line.toLowerCase().startsWith("error"), color: "red" },
  { test: (line) => line.startsWith(">"), color: "yellow" },
  { test: (line) => line.startsWith("+"), color: "green" },
  { test: (line) => line.startsWith("🔒"), color: "magenta" },
  { test: (line) => line.startsWith("💾"), color: "cyan" }
];

function colorFor(line: string, theme: { primary: string; success: string; warning: string; muted: string }): string | undefined {
  for (const pattern of EVENT_PATTERNS) {
    if (pattern.test(line)) {
      return pattern.color;
    }
  }
  return undefined;
}

export function AgentStatus({ lines, maxVisible = 20 }: AgentStatusProps): React.JSX.Element {
  const theme = useTheme();
  const visible = lines.slice(-maxVisible);

  if (visible.length === 0) {
    return (
      <Text color={theme.muted} dimColor>
        No agent activity yet.
      </Text>
    );
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      {visible.map((line, index) => {
        const color = colorFor(line, theme);
        return (
          <Text key={`${line}-${index}`} color={color}>
            {line}
          </Text>
        );
      })}
    </Box>
  );
}
