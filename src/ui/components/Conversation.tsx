/**
 * Zeno UI v2 — Conversation (spec §5, docs/ui/component-spec.md § Message blocks).
 *
 * Renders user/assistant/system messages with the semantic `›` user glyph and
 * Markdown-aware assistant bodies (Phase 3): headers, lists, code, tables,
 * links (OSC 8 when available), and unified diffs — all borderless and muted by
 * default. Supports streaming (trailing cursor), collapsible messages
 * (progressive disclosure), quiet single-line tool activity, and transcript
 * virtualization via `maxVisible`.
 *
 * Components read `UIState` and render; they never modify messages (the event
 * bus / shell owns state).
 */

import React from "react";
import { Box, Text } from "ink";
import { useUiTheme, type ResolvedTheme } from "../theme/provider.js";
import { resolveSymbols } from "../render/markdown.js";
import { parseMarkdown } from "../render/markdown-parse.js";
import { MarkdownBlock } from "../render/markdown-blocks.jsx";
import { Activity } from "./Activity.js";
import type { ActivityLine } from "../activity/types.js";
import { TaskBlock } from "./TaskBlock.js";
import type { TaskItem } from "./TaskBlock.js";
import { DiffBlock } from "./DiffBlock.js";

export interface ChatLine {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  /** True while the message is still streaming in. */
  streaming?: boolean;
  /** Collapsed to a one-line summary (progressive disclosure, spec §33). */
  collapsed?: boolean;
  /** One-line summary shown when collapsed (defaults to first line). */
  summary?: string;
}

function UserMessage({
  content,
  unicode,
  theme,
}: {
  content: string;
  unicode: boolean;
  theme: ResolvedTheme;
}): React.JSX.Element {
  const symbols = resolveSymbols(unicode);
  return (
    <Box flexDirection="column">
      <Text bold color={theme.noColor ? undefined : theme.palette.accent}>
        {symbols.user} {content}
      </Text>
    </Box>
  );
}

function Cursor({ unicode, theme }: { unicode: boolean; theme: ResolvedTheme }): React.JSX.Element {
  const glyph = unicode ? "▍" : "|";
  return <Text color={theme.noColor ? undefined : theme.palette.subtle}>{glyph}</Text>;
}

function AssistantMessage({
  content,
  streaming,
  collapsed,
  summary,
  unicode,
  osc8,
  theme,
}: {
  content: string;
  streaming: boolean;
  collapsed: boolean;
  summary?: string;
  unicode: boolean;
  osc8: boolean;
  theme: ResolvedTheme;
}): React.JSX.Element {
  const symbols = resolveSymbols(unicode);

  // Collapsed: show the summary (or first line) as a single quiet line.
  if (collapsed) {
    const line = summary ?? content.split("\n")[0] ?? "";
    return (
      <Box flexDirection="column">
        <Text color={theme.noColor ? undefined : theme.palette.muted}>
          {symbols.action} {line}
        </Text>
      </Box>
    );
  }

  const blocks = parseMarkdown(content);
  return (
    <Box flexDirection="column" marginLeft={2}>
      {blocks.map((block, i) => (
        <MarkdownBlock key={i} block={block} unicode={unicode} osc8={osc8} theme={theme} />
      ))}
      {streaming ? <Cursor unicode={unicode} theme={theme} /> : null}
    </Box>
  );
}

function ToolLine({
  content,
  theme,
}: {
  content: string;
  theme: ResolvedTheme;
}): React.JSX.Element {
  // Quiet operational line (spec §30 "no raw tool logs"). Phase 5 aggregates
  // multiple events into richer Activity lines; here we keep it to one line.
  const isError = content.startsWith("✗") || content.startsWith("!") || content.startsWith("[error]");
  return (
    <Text color={theme.noColor ? undefined : (isError ? theme.palette.warning : theme.palette.muted)}>
      {content}
    </Text>
  );
}

export interface GreetingProps {
  /** Compact one-line greeting on first run (spec §27). */
  version: string;
  cwd: string;
  /** Providers configured: short status text. */
  providerCount: number;
}

export function Greeting({ version, cwd, providerCount }: GreetingProps): React.JSX.Element {
  const theme = useUiTheme();
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={theme.noColor ? undefined : theme.palette.accent} bold>
        ZenoCLI
      </Text>
      <Text color={theme.noColor ? undefined : theme.palette.muted}>
        v{version} · {cwd} · {providerCount > 0 ? `${providerCount} providers ready` : "no provider configured"}
      </Text>
      <Text color={theme.noColor ? undefined : theme.palette.subtle}>
        Ask me to build, fix, or explain something. Type /help for commands.
      </Text>
    </Box>
  );
}

export interface ConversationProps {
  messages: ChatLine[];
  unicode: boolean;
  /** OSC 8 hyperlink support for markdown links. */
  osc8?: boolean;
  /** Max messages to render; older ones hidden with a marker. */
  maxVisible?: number;
  /** Activity lines (Phase 5) rendered in the conversation flow. */
  activityLines?: ActivityLine[];
  /** Index of the focused activity line for progressive disclosure. */
  focusedActivityIndex?: number;
  /** Task items (Phase 6) for inline task blocks. */
  taskItems?: TaskItem[];
  /** Whether to expand task items (default: collapsed). */
  taskExpanded?: boolean;
  /** Title for the task block. */
  taskTitle?: string;
  /** Raw unified diff text for inline diff display (Phase 7). */
  diffText?: string;
  /** Index of the focused file in the diff block. */
  focusedDiffFileIndex?: number;
}

export function Conversation({
  messages,
  unicode,
  osc8 = true,
  maxVisible = 50,
  activityLines,
  focusedActivityIndex,
  taskItems,
  taskExpanded = false,
  taskTitle = "Plan",
  diffText,
  focusedDiffFileIndex = 0,
}: ConversationProps): React.JSX.Element {
  const theme = useUiTheme();

  if (messages.length === 0) {
    return (
      <Text color={theme.noColor ? undefined : theme.palette.muted}>
        {resolveSymbols(unicode).user} Type a prompt to begin.
      </Text>
    );
  }

  const hiddenCount = Math.max(0, messages.length - maxVisible);
  const visible = messages.slice(-maxVisible);

  return (
    <Box flexDirection="column" marginTop={1}>
      {hiddenCount > 0 ? (
        <Text color={theme.noColor ? undefined : theme.palette.subtle}>
          [{hiddenCount} earlier messages hidden]
        </Text>
      ) : null}
      {visible.map((message) => {
        switch (message.role) {
          case "user":
            return <UserMessage key={message.id} content={message.content} unicode={unicode} theme={theme} />;
          case "assistant":
            return (
              <AssistantMessage
                key={message.id}
                content={message.content}
                streaming={message.streaming ?? false}
                collapsed={message.collapsed ?? false}
                summary={message.summary}
                unicode={unicode}
                osc8={osc8}
                theme={theme}
              />
            );
          case "tool":
            return <ToolLine key={message.id} content={message.content} theme={theme} />;
          default:
            return (
              <Text key={message.id} color={theme.noColor ? undefined : theme.palette.subtle}>
                {message.content}
              </Text>
            );
        }
      })}
      {activityLines && activityLines.length > 0 ? (
        <Activity lines={activityLines} focusedIndex={focusedActivityIndex ?? -1} unicode={unicode} />
      ) : null}
      {taskItems && taskItems.length > 0 ? (
        <TaskBlock title={taskTitle} items={taskItems} expanded={taskExpanded} unicode={unicode} />
      ) : null}
      {diffText ? (
        <DiffBlock diffText={diffText} unicode={unicode} focusedFileIndex={focusedDiffFileIndex} />
      ) : null}
    </Box>
  );
}