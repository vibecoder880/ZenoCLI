import React from "react";
import { Box, Text } from "ink";

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

function colorFor(line: string): string | undefined {
  for (const pattern of EVENT_PATTERNS) {
    if (pattern.test(line)) {
      return pattern.color;
    }
  }
  return undefined;
}

export function AgentStatus({ lines, maxVisible = 20 }: AgentStatusProps): React.JSX.Element {
  const visible = lines.slice(-maxVisible);

  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column" marginTop={1}>
      {visible.length === 0 ? (
        <Text dimColor>No agent activity yet.</Text>
      ) : (
        visible.map((line, index) => {
          const color = colorFor(line);
          return (
            <Text key={`${line}-${index}`} color={color}>
              {line}
            </Text>
          );
        })
      )}
    </Box>
  );
}
