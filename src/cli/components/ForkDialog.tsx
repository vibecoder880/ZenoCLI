import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { forkSession, type SessionEntry, type SessionWriter } from "../../core/session.js";

interface ForkDialogProps {
  sessionId: string;
  cwd: string;
  entries: SessionEntry[];
  onClose: () => void;
  onFork: (writer: SessionWriter) => void;
}

/** Preview text for a session entry. */
function entryPreview(entry: SessionEntry): string {
  const content = typeof entry.content === "string" ? entry.content : String(entry.content ?? "");
  return content.replace(/\s+/g, " ").slice(0, 60);
}

/**
 * Fork dialog (opencode-style): pick a message index; forking carries all
 * entries up to (excluding) the selection, starting a new session from there.
 */
export function ForkDialog({ sessionId, cwd, entries, onClose, onFork }: ForkDialogProps): React.JSX.Element {
  const [selected, setSelected] = useState(Math.max(0, entries.length - 1));

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelected((current) => (current === 0 ? entries.length - 1 : current - 1));
    } else if (key.downArrow) {
      setSelected((current) => (current === entries.length - 1 ? 0 : current + 1));
    } else if (key.return) {
      try {
        const writer = forkSession(sessionId, cwd, selected);
        onFork(writer);
      } catch {
        onClose();
      }
    } else if (key.escape) {
      onClose();
    }
  });

  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column" marginTop={1}>
      <Text bold>Fork from message (↑/↓ Enter Esc)</Text>
      <Text dimColor>Entries before the selected message carry into the fork.</Text>
      {entries.map((entry, index) => (
        <Text key={index} inverse={index === selected}>
          {"  "}
          {String(index).padStart(3, " ")} {entry.type.padEnd(10)} {entryPreview(entry)}
        </Text>
      ))}
    </Box>
  );
}