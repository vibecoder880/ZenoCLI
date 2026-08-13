/**
 * Zeno UI v2 — markdown block renderer (spec §5, docs/ui/component-spec.md
 * § Message blocks).
 *
 * Renders the block/inline structure from `markdown-parse.ts` as Ink elements,
 * using theme tokens only. No borders, no background boxes. Links degrade to
 * plain `[text](url)` when the terminal lacks OSC 8. `NO_COLOR` renders the
 * structure without color.
 */

import React from "react";
import { Box, Text } from "ink";
import { useUiTheme, type ResolvedTheme } from "../theme/provider.js";
import type { Block, Inline } from "./markdown-parse.js";

interface BlockProps {
  block: Block;
  unicode: boolean;
  osc8: boolean;
  theme: ResolvedTheme;
}

function colorOf(theme: ResolvedTheme): string | undefined {
  return theme.noColor ? undefined : theme.palette.muted;
}

function InlineNodes({
  nodes,
  unicode,
  osc8,
  theme,
}: {
  nodes: Inline[];
  unicode: boolean;
  osc8: boolean;
  theme: ResolvedTheme;
}): React.JSX.Element {
  return (
    <>
      {nodes.map((node, i) => {
        switch (node.type) {
          case "text":
            return <Text key={i}>{node.value}</Text>;
          case "bold":
            return (
              <Text key={i} bold>
                <InlineNodes nodes={node.children} unicode={unicode} osc8={osc8} theme={theme} />
              </Text>
            );
          case "italic":
            return (
              <Text key={i} italic>
                <InlineNodes nodes={node.children} unicode={unicode} osc8={osc8} theme={theme} />
              </Text>
            );
          case "code":
            return (
              <Text key={i} color={theme.noColor ? undefined : theme.palette.warning}>
                {node.value}
              </Text>
            );
          case "link":
            return osc8 ? (
              <Text key={i} color={theme.noColor ? undefined : theme.palette.accent}>
                {`]8;;${node.url}\\${node.text}]8;;\\`}
              </Text>
            ) : (
              <Text key={i} color={theme.noColor ? undefined : theme.palette.accent}>
                {node.text} ({node.url})
              </Text>
            );
        }
      })}
    </>
  );
}

function CodeBlock({ block }: { block: Extract<Block, { type: "code" }> }): React.JSX.Element {
  const theme = useUiTheme();
  const lines = block.value.split("\n");
  return (
    <Box flexDirection="column" marginLeft={2}>
      {lines.map((line, i) => (
        <Text key={i} color={colorOf(theme)}>
          {line || " "}
        </Text>
      ))}
    </Box>
  );
}

function DiffBlock({ block }: { block: Extract<Block, { type: "diff" }> }): React.JSX.Element {
  const theme = useUiTheme();
  const lines = block.value.split("\n");
  return (
    <Box flexDirection="column" marginLeft={2}>
      {lines.map((line, i) => {
        if (line.startsWith("+")) {
          return (
            <Text key={i} color={theme.noColor ? undefined : theme.palette.success}>
              {line}
            </Text>
          );
        }
        if (line.startsWith("-")) {
          return (
            <Text key={i} color={theme.noColor ? undefined : theme.palette.error}>
              {line}
            </Text>
          );
        }
        if (line.startsWith("@@")) {
          return (
            <Text key={i} color={theme.noColor ? undefined : theme.palette.accent}>
              {line}
            </Text>
          );
        }
        return (
          <Text key={i} color={colorOf(theme)}>
            {line}
          </Text>
        );
      })}
    </Box>
  );
}

function TableBlock({ block }: { block: Extract<Block, { type: "table" }> }): React.JSX.Element {
  const theme = useUiTheme();
  const width = Math.max(...block.header.map((h) => h.length), 8);
  const pad = (cell: string): string => cell.padEnd(width);
  return (
    <Box flexDirection="column" marginLeft={2}>
      <Text color={theme.noColor ? undefined : theme.palette.accent} bold>
        {block.header.map(pad).join(" ")}
      </Text>
      {block.rows.map((row, i) => (
        <Text key={i} color={colorOf(theme)}>
          {row.map(pad).join(" ")}
        </Text>
      ))}
    </Box>
  );
}

export function MarkdownBlock({
  block,
  unicode,
  osc8,
  theme,
}: BlockProps): React.JSX.Element {
  switch (block.type) {
    case "heading":
      return (
        <Text bold color={theme.noColor ? undefined : theme.palette.text}>
          <InlineNodes nodes={block.children} unicode={unicode} osc8={osc8} theme={theme} />
        </Text>
      );
    case "paragraph":
      return (
        <Text color={theme.noColor ? undefined : theme.palette.text}>
          <InlineNodes nodes={block.children} unicode={unicode} osc8={osc8} theme={theme} />
        </Text>
      );
    case "list": {
      const marker = block.ordered ? (index: number): string => `${index + 1}.` : (): string => "·";
      return (
        <Box flexDirection="column" marginLeft={2}>
          {block.items.map((item, i) => (
            <Text key={i} color={colorOf(theme)}>
              {marker(i)} <InlineNodes nodes={item.children} unicode={unicode} osc8={osc8} theme={theme} />
            </Text>
          ))}
        </Box>
      );
    }
    case "code":
      return <CodeBlock block={block} />;
    case "quote":
      return (
        <Text color={colorOf(theme)}>
          │ <InlineNodes nodes={block.children} unicode={unicode} osc8={osc8} theme={theme} />
        </Text>
      );
    case "rule":
      return <Text color={colorOf(theme)}>─────</Text>;
    case "table":
      return <TableBlock block={block} />;
    case "diff":
      return <DiffBlock block={block} />;
  }
}
