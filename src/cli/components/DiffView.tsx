import React from "react";
import { Box, Text } from "ink";

/** One parsed line of a unified diff. */
export interface DiffLine {
  type: "add" | "del" | "ctx" | "hunk" | "meta";
  text: string;
}

/**
 * Parse a unified diff into categorized lines.
 * Handles `diff --git`, `index`, `---/+++`, `@@ hunk @@`, `+`/`-`/context, and
 * `\ No newline` markers. Malformed input degrades to a single context line.
 */
export function parseUnifiedDiff(content: string): DiffLine[] {
  const lines: DiffLine[] = [];
  for (const raw of content.split("\n")) {
    const line = raw;
    if (line.startsWith("diff --git") || line.startsWith("index ") || line.startsWith("new file") || line.startsWith("deleted file")) {
      lines.push({ type: "meta", text: line });
    } else if (line.startsWith("@@")) {
      lines.push({ type: "hunk", text: line });
    } else if (line.startsWith("+++") || line.startsWith("---")) {
      lines.push({ type: "meta", text: line });
    } else if (line.startsWith("+")) {
      lines.push({ type: "add", text: line });
    } else if (line.startsWith("-")) {
      lines.push({ type: "del", text: line });
    } else {
      lines.push({ type: "ctx", text: line });
    }
  }
  return lines;
}

/** Color a diff line by its type. */
function lineColor(type: DiffLine["type"]): string | undefined {
  switch (type) {
    case "add":
      return "green";
    case "del":
      return "red";
    case "hunk":
      return "cyan";
    case "meta":
      return "yellow";
    default:
      return undefined;
  }
}

/** Render a parsed diff with syntax-aware coloring. */
export function DiffView({ content }: { content: string }): React.JSX.Element {
  const lines = parseUnifiedDiff(content);
  return (
    <Box flexDirection="column" marginLeft={1}>
      {lines.map((line, index) => (
        <Text key={index} color={lineColor(line.type)}>
          {line.text}
        </Text>
      ))}
    </Box>
  );
}
