import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, render, useApp, useInput } from "ink";
import { AgentStatus } from "./components/AgentStatus.js";
import { Header } from "./components/Header.js";
import { MessageList, type ChatLine } from "./components/MessageList.js";
import { Prompt } from "./components/Prompt.js";
import { SlashMenu } from "./components/SlashMenu.js";
import { createProvider } from "../providers/index.js";
import type { ChatMessage } from "../providers/base.js";
import { filterSlashCommands } from "./slash-commands.js";

interface LaunchOptions {
  model: string;
  provider: string;
  initialPrompt?: string;
}

interface ChatAppProps extends LaunchOptions {
  onExit: () => void;
}

function createLine(role: ChatLine["role"], content: string): ChatLine {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content
  };
}

function ChatApp({ model, provider, initialPrompt, onExit }: ChatAppProps): React.JSX.Element {
  const { exit } = useApp();
  const [input, setInput] = useState(initialPrompt ?? "");
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [agentLines, setAgentLines] = useState<string[]>(["Ready"]);
  const [tokenCount, setTokenCount] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const slashCommands = useMemo(() => filterSlashCommands(input), [input]);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);

  useEffect(() => {
    setSelectedSlashIndex(0);
  }, [slashCommands.length]);

  useInput((_, key) => {
    if (slashCommands.length === 0) {
      if (key.escape) {
        exit();
        onExit();
      }

      return;
    }

    if (key.upArrow) {
      setSelectedSlashIndex((current) =>
        current === 0 ? slashCommands.length - 1 : current - 1
      );
      return;
    }

    if (key.downArrow) {
      setSelectedSlashIndex((current) =>
        current === slashCommands.length - 1 ? 0 : current + 1
      );
      return;
    }

    if (key.escape) {
      setInput("");
      return;
    }

    if (key.tab || key.return) {
      const selected = slashCommands[selectedSlashIndex];
      setInput(selected.command);
    }
  });

  const submitPrompt = async (rawValue: string): Promise<void> => {
    const value = rawValue.trim();

    if (!value || isBusy) {
      return;
    }

    if (value.startsWith("/")) {
      if (value === "/exit") {
        exit();
        onExit();
        return;
      }

      if (value === "/clear") {
        setMessages([]);
        setAgentLines(["Conversation cleared"]);
        setInput("");
        return;
      }

      setAgentLines([`Command ${value} is reserved for a later phase.`]);
      setInput("");
      return;
    }

    setIsBusy(true);
    setInput("");
    setAgentLines(["Preparing request", `Provider ${provider}`, `Model ${model}`]);

    const userLine = createLine("user", value);
    const assistantLine = createLine("assistant", "");
    const nextMessages = [...messages, userLine];
    setMessages([...nextMessages, assistantLine]);

    try {
      const aiProvider = createProvider(provider);
      const requestMessages: ChatMessage[] = nextMessages.map((message) => ({
        role: message.role,
        content: message.content
      }));

      for await (const event of aiProvider.chat({
        model,
        messages: requestMessages
      })) {
        if (event.type === "text") {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantLine.id
                ? { ...message, content: `${message.content}${event.content}` }
                : message
            )
          );
        }

        if (event.type === "done") {
          setTokenCount((current) => current + (event.usage?.totalTokens ?? 0));
          setAgentLines(["Response complete"]);
        }

        if (event.type === "error") {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantLine.id ? { ...message, content: event.message } : message
            )
          );
          setAgentLines([event.message]);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown provider error";
      setMessages((current) =>
        current.map((entry) =>
          entry.id === assistantLine.id ? { ...entry, content: message } : entry
        )
      );
      setAgentLines([message]);
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    if (initialPrompt) {
      void submitPrompt(initialPrompt);
    }
  }, []);

  return (
    <Box flexDirection="column">
      <Header model={model} provider={provider} tokens={tokenCount} />
      <AgentStatus lines={agentLines} />
      <MessageList messages={messages} />
      {input.startsWith("/") ? (
        <SlashMenu commands={slashCommands} selectedIndex={selectedSlashIndex} />
      ) : null}
      <Prompt
        value={input}
        placeholder={isBusy ? "Waiting for response..." : "Ask NeuroCLI to help"}
        disabled={isBusy}
        onChange={setInput}
        onSubmit={(value) => {
          void submitPrompt(value);
        }}
      />
      <Text dimColor>Esc exits the app. OPENAI_API_KEY is required for Phase 1 chat.</Text>
    </Box>
  );
}

export async function launchChatTui(options: LaunchOptions): Promise<void> {
  await new Promise<void>((resolve) => {
    const app = render(<ChatApp {...options} onExit={resolve} />);

    app.waitUntilExit().then(resolve).catch(resolve);
  });
}
