import React from "react";
import { Box, Text } from "ink";

interface AgentStatusProps {
  lines: string[];
}

export function AgentStatus({ lines }: AgentStatusProps): React.JSX.Element {
  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column" marginTop={1}>
      {lines.length === 0 ? (
        <Text dimColor>No agent activity yet.</Text>
      ) : (
        lines.map((line, index) => <Text key={`${line}-${index}`}>{line}</Text>)
      )}
    </Box>
  );
}
