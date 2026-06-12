import React from "react";
import { Box, Text } from "ink";

const VERSION = "0.2.0";

function formatCost(usd: number): string {
  if (usd >= 1) {
    return `$${usd.toFixed(2)}`;
  }
  return `$${usd.toFixed(4)}`;
}

export interface HeaderProps {
  model: string;
  provider: string;
  tokens: number;
  historyEntries: number;
  sessionId: string;
  mode: string;
  permissionMode: string;
  sessionCost: number;
}

export function Header({
  model,
  provider,
  tokens,
  historyEntries,
  sessionId,
  mode,
  permissionMode,
  sessionCost
}: HeaderProps): React.JSX.Element {
  return (
    <Box
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      flexDirection="column"
    >
      <Box>
        <Text bold color="cyan">
          NeuroCLI
        </Text>
        <Text dimColor> · v{VERSION}</Text>
      </Box>
      <Text color="green">
        {provider}/{model}
      </Text>
      <Text dimColor>
        session {sessionId.slice(0, 12)} · {mode} · {permissionMode} · {formatCost(sessionCost)} · {tokens} tok · {historyEntries} hist
      </Text>
    </Box>
  );
}
