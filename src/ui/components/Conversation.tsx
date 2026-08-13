/**
 * Zeno UI v2 — Conversation (spec §5, docs/ui/component-spec.md § Message blocks).
 *
 * Renders user/assistant messages with the semantic `›` user glyph and muted
 * assistant body. No bubbles, no borders. A minimal one-line greeting replaces
 * the old ASCII banner. Phase 3 adds markdown/code/diff rendering.
 */

import React from "react";
import { Box, Text } from "ink";
import { useUiTheme } from "../theme/provider.js";
import { resolveSymbols } from "../render/markdown.js";

export interface ChatLine {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
}

function UserMessage({
  content,
  unicode,
  theme,
}: {
  content: string;
  unicode: boolean;
  theme: ReturnType<typeof useUiTheme>;
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

function AssistantMessage({
  content,
  unicode,
  theme,
}: {
  content: string;
  unicode: boolean;
  theme: ReturnType<typeof useUiTheme>;
}): React.JSX.Element {
  const symbols = resolveSymbols(unicode);
  return (
    <Box flexDirection="column">
      <Text color={theme.noColor ? undefined : theme.palette.muted}>
        {symbols.active}
      </Text>
      <Box marginLeft={2}>
        <Text>{content}</Text>
      </Box>
    </Box>
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
  /** Max messages to render; older ones hidden with a marker. */
  maxVisible?: number;
}

export function Conversation({
  messages,
  unicode,
  maxVisible = 50,
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
      {visible.map((message) =>
        message.role === "user" ? (
          <UserMessage key={message.id} content={message.content} unicode={unicode} theme={theme} />
        ) : message.role === "assistant" ? (
          <AssistantMessage key={message.id} content={message.content} unicode={unicode} theme={theme} />
        ) : (
          <Text key={message.id} color={theme.noColor ? undefined : theme.palette.subtle}>
            {message.content}
          </Text>
        ),
      )}
    </Box>
  );
}