import React from "react";
import { Box, Text } from "ink";

export interface ChatLine {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
}

interface MessageBubbleProps {
  message: ChatLine;
}

function rolePrefix(role: ChatLine["role"]): { icon: string; color: string; label: string } {
  switch (role) {
    case "user":
      return { icon: "▸", color: "cyan", label: "You" };
    case "assistant":
      return { icon: "◆", color: "green", label: "Assistant" };
    default:
      return { icon: "·", color: "gray", label: "System" };
  }
}

function MessageBubble({ message }: MessageBubbleProps): React.JSX.Element {
  const { icon, color, label } = rolePrefix(message.role);
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text>
        <Text color={color} bold>
          {icon} {label}
        </Text>
      </Text>
      <Box marginLeft={2}>
        <Text>{message.content}</Text>
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
  const hiddenCount = Math.max(0, messages.length - maxVisible);
  const visible = messages.slice(-maxVisible);

  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column" marginTop={1}>
      {visible.length === 0 ? (
        <Text dimColor>Conversation is empty. Type a prompt to begin.</Text>
      ) : (
        <>
          {hiddenCount > 0 ? (
            <Text dimColor>[... {hiddenCount} earlier messages hidden ...]</Text>
          ) : null}
          {visible.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </>
      )}
    </Box>
  );
}
