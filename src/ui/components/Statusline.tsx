/**
 * Zeno UI v2 — Statusline (Phase 2 minimal; Phase 10 adds configurability).
 *
 * A single right-aligned row of informational sections. Not a dashboard —
 * one line, muted unless something needs attention. Width-aware: sections are
 * dropped as the terminal narrows (docs/ui/responsive.md § width tiers).
 */

import React from "react";
import { Box, Text } from "ink";
import { useUiTheme } from "../theme/provider.js";

export interface StatusSection {
  key: string;
  text: string;
  /** Optional semantic color highlight; muted by default. */
  emphasis?: "success" | "warning" | "error" | "accent";
}

export interface StatuslineProps {
  sections: StatusSection[];
  /** ISO-ish duration string rendered as-is (e.g. "2m41s"). */
  duration?: string;
  /** True to truncate to essential sections immediately. */
  compact?: boolean;
  /** Number of running background agents. */
  agentCount?: number;
}

/** Which sections survive at narrow widths (docs/ui/responsive.md). */
const NARROW_ORDER = ["model", "context", "cost", "duration"] as const;
const WIDE_ORDER = ["branch", "model", "context", "tokens", "cost", "duration", "agents"] as const;

function rankOf(key: string): number {
  const idx = WIDE_ORDER.indexOf(key as (typeof WIDE_ORDER)[number]);
  return idx === -1 ? WIDE_ORDER.length : idx;
}

function emphasisColor(emphasis: StatusSection["emphasis"]): string | undefined {
  switch (emphasis) {
    case "success":
      return "green";
    case "warning":
      return "yellow";
    case "error":
      return "red";
    case "accent":
      return "magenta";
    default:
      return undefined;
  }
}

export function Statusline({ sections, duration, compact = false, agentCount }: StatuslineProps): React.JSX.Element | null {
  const theme = useUiTheme();

  let ordered = [...sections].sort((a, b) => rankOf(a.key) - rankOf(b.key));
  if (compact) {
    ordered = ordered.filter((section) =>
      (NARROW_ORDER as readonly string[]).includes(section.key),
    );
  }

  if (duration) {
    ordered.push({ key: "duration", text: duration });
  }

  if (agentCount && agentCount > 0) {
    ordered.push({ key: "agents", text: `${agentCount} agent${agentCount === 1 ? "" : "s"}`, emphasis: "accent" });
  }

  if (ordered.length === 0) {
    return null;
  }

  return (
    <Box justifyContent="flex-end">
      <Text color={theme.noColor ? undefined : theme.palette.muted}>
        {ordered.map((section, index) => {
          const color = theme.noColor ? undefined : emphasisColor(section.emphasis);
          return (
            <React.Fragment key={section.key}>
              {index > 0 ? <Text dimColor> · </Text> : null}
              <Text color={color}>{section.text}</Text>
            </React.Fragment>
          );
        })}
      </Text>
    </Box>
  );
}