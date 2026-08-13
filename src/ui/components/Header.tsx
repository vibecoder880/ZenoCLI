/**
 * Zeno UI v2 — Header (spec §4, docs/ui/component-spec.md § Header).
 *
 * Compact, ≤ 2 lines, no border, no background block. Line 1 shows brand +
 * model/provider + git branch + runtime status; line 2 shows the cwd and the
 * context percentage. Width-aware: narrow terminals collapse to essentials
 * (docs/ui/responsive.md).
 */

import React from "react";
import { Box, Text } from "ink";
import { createRequire } from "node:module";
import { useUiTheme } from "../theme/provider.js";

const require = createRequire(import.meta.url);
const pkg = require("../../../package.json") as { version: string };

/** Package version, read once at module load (mirrors the v1 Header). */
export const VERSION: string = pkg.version;

export interface HeaderProps {
  version: string;
  provider: string;
  model: string;
  branch: string;
  cwd: string;
  /** Context usage as a percentage, e.g. 18. */
  contextPct: number;
  /** Runtime status: "thinking" | "agents" | undefined (idle). */
  status?: "thinking" | "agents" | "idle" | undefined;
  agents?: number;
  /** True when < 80 columns (docs/ui/responsive.md). */
  compact?: boolean;
}

function statusText(status: HeaderProps["status"], agents?: number): string {
  switch (status) {
    case "thinking":
      return "thinking";
    case "agents":
      return `${agents ?? ""} agents`.trim();
    default:
      return "";
  }
}

export function Header({
  version,
  provider,
  model,
  branch,
  cwd,
  contextPct,
  status,
  agents,
  compact = false,
}: HeaderProps): React.JSX.Element {
  const theme = useUiTheme();
  const statusLine = statusText(status, agents);

  const leftLine1 = (
    <>
      <Text bold color={theme.noColor ? undefined : theme.palette.accent}>
        ZENO
      </Text>
      <Text color={theme.noColor ? undefined : theme.palette.muted}> v{version}</Text>
    </>
  );

  const rightLine1 = (
    <>
      <Text color={theme.noColor ? undefined : theme.palette.muted}>
        {provider}/{model}
      </Text>
      {branch ? <Text dimColor> · {branch}</Text> : null}
      {statusLine ? <Text dimColor> · {statusLine}</Text> : null}
    </>
  );

  const line2 = compact ? (
    <Text dimColor>{cwd}</Text>
  ) : (
    <>
      <Text dimColor>{cwd}</Text>
      <Text dimColor> · {contextPct}%</Text>
    </>
  );

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box justifyContent="space-between">
        {leftLine1}
        {rightLine1}
      </Box>
      <Box justifyContent="space-between">
        {line2}
      </Box>
    </Box>
  );
}