import React from "react";
import { Box, Text } from "ink";

export interface ChatLine {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
}

interface MessageListProps {
  messages: ChatLine[];
}

function roleLabel(role: ChatLine["role"]): string {
  switch (role) {
    case "user":
      return "You";
    case "assistant":
      return "Assistant";
    default:
      return "System";
  }
}

export function MessageList({ messages }: MessageListProps): React.JSX.Element {
  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column" marginTop={1}>
      {messages.length === 0 ? (
        <Text dimColor>Conversation is empty. Type a prompt to begin.</Text>
      ) : (
        messages.map((message) => (
          <Box key={message.id} flexDirection="column" marginBottom={1}>
            <Text bold>{roleLabel(message.role)}</Text>
            <Text>{message.content}</Text>
          </Box>
        ))
      )}
    </Box>
  );
}
