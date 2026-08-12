import React from "react";
import { Box, Text } from "ink";
import { createRequire } from "node:module";
import { useTheme } from "../theme.js";

const require = createRequire(import.meta.url);
const pkg = require("../../../package.json") as { version: string };
const VERSION: string = pkg.version;

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
  const theme = useTheme();
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color={theme.primary}>
          ZenoCLI
        </Text>
        <Text color={theme.muted}> v{VERSION}</Text>
        <Text dimColor> · {provider}/{model}</Text>
        <Text color={theme.muted}> · {permissionMode}</Text>
        <Text dimColor> · {formatCost(sessionCost)} · {tokens} tok · {historyEntries} hist</Text>
      </Box>
      <Text dimColor>session {sessionId.slice(0, 12)} · {mode}</Text>
    </Box>
  );
}
