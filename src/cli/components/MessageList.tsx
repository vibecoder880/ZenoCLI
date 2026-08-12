import React from "react";
import { Box, Text } from "ink";
import { DiffView } from "./DiffView.js";
import { useTheme } from "../theme.js";

export interface ChatLine {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
}

/** True when content looks like a unified diff (hunk markers present). */
function isUnifiedDiff(content: string): boolean {
  return content.includes("@@") && /^diff --git|\+|-/m.test(content);
}

interface MessageBubbleProps {
  message: ChatLine;
}

function rolePrefix(role: ChatLine["role"]): { icon: string; label: string } {
  switch (role) {
    case "user":
      return { icon: "▸", label: "You" };
    case "assistant":
      return { icon: "◆", label: "Assistant" };
    default:
      return { icon: "·", label: "System" };
  }
}

function MessageBubble({ message }: MessageBubbleProps): React.JSX.Element {
  const theme = useTheme();
  const { icon, label } = rolePrefix(message.role);
  const roleColor =
    message.role === "user"
      ? theme.primary
      : message.role === "assistant"
        ? theme.success
        : theme.muted;
  return (
    <Box flexDirection="column">
      <Text>
        <Text color={roleColor} bold>
          {icon} {label}
        </Text>
      </Text>
      <Box marginLeft={2}>
        {isUnifiedDiff(message.content) ? (
          <DiffView content={message.content} />
        ) : (
          <Text>{message.content}</Text>
        )}
      </Box>
    </Box>
  );
}

interface MessageListProps {
  messages: ChatLine[];
  /** Max messages to render. Older messages replaced with placeholder. */
  maxVisible?: number;
}

export function MessageList({ messages, maxVisible = 50 }: MessageListProps): React.JSX.Element {
  const theme = useTheme();
  const hiddenCount = Math.max(0, messages.length - maxVisible);
  const visible = messages.slice(-maxVisible);

  return (
    <Box flexDirection="column" marginTop={1}>
      {visible.length === 0 ? (
        <Text color={theme.muted}>Conversation is empty. Type a prompt to begin.</Text>
      ) : (
        <>
          {hiddenCount > 0 ? (
            <Text color={theme.muted}>[... {hiddenCount} earlier messages hidden ...]</Text>
          ) : null}
          {visible.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </>
      )}
    </Box>
  );
}
