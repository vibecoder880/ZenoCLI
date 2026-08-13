/**
 * Zeno UI v2 — AgentActivity (Phase 9, spec §31, docs/ui/component-spec.md § AgentActivity).
 *
 * Inline background agent lines. Shows running agents with status indicators.
 * No panel — just content in the conversation flow.
 */

import React from "react";
import { Box, Text } from "ink";
import { useUiTheme } from "../theme/provider.js";
import { resolveSymbols } from "../render/markdown.js";

export interface AgentInfo {
  id: string;
  name: string;
  status: string;
}

export interface AgentActivityProps {
  agents: AgentInfo[];
  unicode: boolean;
}

export function AgentActivity({
  agents,
  unicode,
}: AgentActivityProps): React.JSX.Element | null {
  const theme = useUiTheme();

  if (agents.length === 0) {
    return null;
  }

  const symbols = resolveSymbols(unicode);
  const runningCount = agents.filter((a) => a.status === "running").length;

  return (
    <Box flexDirection="column" marginLeft={2}>
      <Text color={theme.noColor ? undefined : theme.palette.muted}>
        {runningCount > 0 ? `${runningCount} agent${runningCount === 1 ? "" : "s"} running` : `${agents.length} agent${agents.length === 1 ? "" : "s"}`}
      </Text>
      {agents.map((agent) => (
        <Text key={agent.id}>
          {"  "}
          <Text color={theme.noColor ? undefined : (agent.status === "running" ? theme.palette.accent : theme.palette.muted)}>
            {agent.status === "running" ? symbols.active : symbols.pending}
          </Text>
          {" "}
          <Text color={theme.noColor ? undefined : theme.palette.text}>
            {agent.name}
          </Text>
          {"  "}
          <Text color={theme.noColor ? undefined : theme.palette.subtle}>
            {agent.status}
          </Text>
        </Text>
      ))}
    </Box>
  );
}
