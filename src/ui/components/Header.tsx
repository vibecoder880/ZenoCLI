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
import type { WidthTier } from "../terminal/resize.js";

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
  /** Width tier for responsive layout (docs/ui/responsive.md). */
  widthTier?: WidthTier;
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
  widthTier = "medium",
}: HeaderProps): React.JSX.Element {
  const theme = useUiTheme();
  const statusLine = statusText(status, agents);

  // Width-tier responsive layout (docs/ui/responsive.md § Width tiers)
  const narrow = widthTier === "narrow";
  const showContext = widthTier === "wide" || widthTier === "ultrawide";

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

  // Narrow: single line only (brand + model + branch)
  if (narrow) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Box justifyContent="space-between">
          {leftLine1}
          {rightLine1}
        </Box>
      </Box>
    );
  }

  const line2 = showContext ? (
    <>
      <Text dimColor>{cwd}</Text>
      <Text dimColor> · {contextPct}%</Text>
    </>
  ) : (
    <Text dimColor>{cwd}</Text>
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