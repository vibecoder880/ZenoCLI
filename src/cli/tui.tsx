import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, render, useApp, useInput } from "ink";
import { AgentStatus } from "./components/AgentStatus.js";
import { Header } from "./components/Header.js";
import { MessageList, type ChatLine } from "./components/MessageList.js";
import { Prompt } from "./components/Prompt.js";
import { SlashMenu } from "./components/SlashMenu.js";
import { AuthProfileStore } from "../auth/auth-profiles.js";
import { createProvider } from "../providers/index.js";
import type { ChatMessage } from "../providers/base.js";
import { estimateCostUsd } from "../providers/pricing.js";
import { selectUsableRoute } from "../providers/router-fallback.js";
import { filterSlashCommands, findSlashCommand, SLASH_COMMANDS } from "./slash-commands.js";
import { loadProjectInstructions } from "../core/context.js";
import { collectProviderText } from "../core/stream.js";
import { resolveModelRoute } from "../providers/router.js";
import { getConfigPathname, loadConfig } from "../storage/config.js";
import { appendHistoryEntry, listHistoryEntries, summarizeTokenUsage } from "../storage/history.js";
import { getProjectInstructionsPath } from "../storage/paths.js";
import { listProviderCatalog, tryCreateProvider } from "../providers/index.js";

interface LaunchOptions {
  model: string;
  provider: string;
  cwd: string;
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

function ChatApp({ model, provider, cwd, initialPrompt, onExit }: ChatAppProps): React.JSX.Element {
  const { exit } = useApp();
  const config = useMemo(() => loadConfig(), []);
  const requestedRoute = useMemo(
    () => resolveModelRoute(config, model, provider),
    [config, model, provider]
  );
  const [activeRoute, setActiveRoute] = useState(requestedRoute);
  const [input, setInput] = useState(initialPrompt ?? "");
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [agentLines, setAgentLines] = useState<string[]>(["Ready"]);
  const [tokenCount, setTokenCount] = useState(0);
  const [sessionCost, setSessionCost] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [historyCount, setHistoryCount] = useState(() => listHistoryEntries(200).length);
  const slashCommands = useMemo(() => filterSlashCommands(input), [input]);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);

  useEffect(() => {
    setSelectedSlashIndex(0);
  }, [slashCommands.length]);

  const executeSlashCommand = async (value: string): Promise<boolean> => {
    const command = findSlashCommand(value);

    if (!command) {
      return false;
    }

    if (command.command === "/exit") {
      exit();
      onExit();
      return true;
    }

    if (command.command === "/clear") {
      setMessages([]);
      setAgentLines(["Conversation cleared"]);
      setInput("");
      return true;
    }

    if (command.command === "/help") {
      setAgentLines([SLASH_COMMANDS.map((entry) => entry.command).join(" ")]);
      setInput("");
      return true;
    }

    if (command.command === "/chat") {
      setAgentLines(["Chat mode is active. Type any prompt and press Enter."]);
      setInput("");
      return true;
    }

    if (command.command === "/init") {
      setAgentLines([
        "Workspace bootstrap runs from the terminal command.",
        "Run: neuro init",
        "That creates NEURO.md and .env.example in the current workspace."
      ]);
      setInput("");
      return true;
    }

    if (command.command === "/agent") {
      setAgentLines([
        "Agent mode runs from the terminal command.",
        "Run: neuro agent \"your task\""
      ]);
      setInput("");
      return true;
    }

    if (command.command === "/model") {
      setAgentLines([
        `Requested ${requestedRoute.provider}/${requestedRoute.model}`,
        `Active ${activeRoute.provider}/${activeRoute.model}`,
        `Route source ${activeRoute.source}`
      ]);
      setInput("");
      return true;
    }

    if (command.command === "/auth") {
      const store = new AuthProfileStore();
      setAgentLines(
        ["openai", "anthropic", "google"].map((providerName) => {
          const active = store.getActiveProfile(providerName);
          return `${providerName}: ${active ? `${active.type} ${active.id}` : "not configured"}`;
        })
      );
      setInput("");
      return true;
    }

    if (command.command === "/history") {
      const recent = listHistoryEntries(5);
      setAgentLines(
        recent.length > 0
          ? recent.map(
              (entry) =>
                `${entry.id} ${entry.provider}/${entry.model} ${new Date(entry.createdAt).toLocaleString()}`
            )
          : ["No stored history yet."]
      );
      setInput("");
      return true;
    }

    if (command.command === "/cost") {
      const usage = summarizeTokenUsage();
      setAgentLines([
        `Tracked sessions ${usage.totalEntries}`,
        `Tracked tokens ${usage.totalTokens}`,
        `Tracked cost $${usage.totalEstimatedCostUsd.toFixed(6)}`,
        `Current session tokens ${tokenCount}`,
        `Current session cost $${sessionCost.toFixed(6)}`
      ]);
      setInput("");
      return true;
    }

    if (command.command === "/health") {
      const lines: string[] = [];
      for (const entry of listProviderCatalog()) {
        const created = tryCreateProvider(entry.slug);
        if (!created.ok) {
          lines.push(`${entry.slug}: unavailable`);
          continue;
        }

        const status = await created.provider.healthCheck();
        lines.push(`${entry.slug}: ${status.ok ? "ok" : "error"}`);
      }
      setAgentLines(lines);
      setInput("");
      return true;
    }

    if (command.command === "/models") {
      const lines = Object.entries(config.aliases).map(([alias, target]) => `alias ${alias} -> ${target}`);
      for (const entry of listProviderCatalog()) {
        const created = tryCreateProvider(entry.slug);
        if (!created.ok) {
          lines.push(`${entry.slug}: unavailable`);
          continue;
        }

        const models = await created.provider.listModels();
        for (const modelInfo of models) {
          lines.push(`${entry.slug}: ${modelInfo.id}`);
        }
      }
      setAgentLines(lines);
      setInput("");
      return true;
    }

    if (command.command === "/config") {
      setAgentLines([
        `Config path ${getConfigPathname()}`,
        `default.model ${config.default.model}`,
        `default.provider ${config.default.provider}`,
        `default.streaming ${config.default.streaming}`
      ]);
      setInput("");
      return true;
    }

    if (command.command === "/context") {
      const instructions = loadProjectInstructions(cwd);
      setAgentLines(
        instructions
          ? [`Context file ${getProjectInstructionsPath(cwd)}`, instructions.slice(0, 200)]
          : [`No NEURO.md found at ${getProjectInstructionsPath(cwd)}`]
      );
      setInput("");
      return true;
    }

    if (command.command === "/compact") {
      const compactText = messages
        .slice(-6)
        .map((message) => `${message.role}: ${message.content.slice(0, 80)}`)
        .join(" | ");
      setAgentLines([compactText || "Conversation is empty."]);
      setInput("");
      return true;
    }

    return false;
  };

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

    if (key.tab) {
      const selected = slashCommands[selectedSlashIndex];
      setInput(selected.command);
      return;
    }

    if (key.return) {
      const selected = slashCommands[selectedSlashIndex];
      void executeSlashCommand(selected.command);
    }
  });

  const submitPrompt = async (rawValue: string): Promise<void> => {
    const value = rawValue.trim();

    if (!value || isBusy) {
      return;
    }

    if (value.startsWith("/")) {
      const executed = await executeSlashCommand(value);
      if (executed) {
        return;
      }

      setAgentLines([`Command ${value} is reserved for a later phase.`]);
      setInput("");
      return;
    }

    setIsBusy(true);
    setInput("");
    const selection = selectUsableRoute(config, undefined, model, provider);
    const route = selection.route;
    setActiveRoute(route);
    setAgentLines(
      [
        "Preparing request",
        selection.warning,
        `Provider ${route.provider}`,
        `Model ${route.model}`
      ].filter((line): line is string => Boolean(line))
    );

    const userLine = createLine("user", value);
    const assistantLine = createLine("assistant", "");
    const nextMessages = [...messages, userLine];
    setMessages([...nextMessages, assistantLine]);

    try {
      const aiProvider = createProvider(route.provider);
      const projectInstructions = loadProjectInstructions(cwd);
      const requestMessages: ChatMessage[] = nextMessages.map((message) => ({
        role: message.role,
        content: message.content
      }));
      const enrichedMessages = [
        ...(projectInstructions
          ? [{ role: "system" as const, content: `Project instructions:\n${projectInstructions}` }]
          : []),
        ...requestMessages
      ];

      const result = await collectProviderText(aiProvider, route.model, enrichedMessages, (chunk) => {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantLine.id ? { ...message, content: `${message.content}${chunk}` } : message
          )
        );
      });

      setTokenCount((current) => current + result.totalTokens);
      const requestCost =
        estimateCostUsd(route.provider, route.model, result.inputTokens, result.outputTokens) ?? 0;
      setSessionCost((current) => Number((current + requestCost).toFixed(6)));
      setAgentLines([
        "Response complete",
        `Request cost $${requestCost.toFixed(6)}`
      ]);
      appendHistoryEntry({
        cwd,
        provider: route.provider,
        model: route.model,
        prompt: value,
        response: result.text,
        totalTokens: result.totalTokens,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        estimatedCostUsd: requestCost
      });
      setHistoryCount(listHistoryEntries(200).length);
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
      <Header
        model={activeRoute.model}
        provider={activeRoute.provider}
        tokens={tokenCount}
        historyEntries={historyCount}
      />
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
      <Text dimColor>
        Esc exits the app. Active route: {activeRoute.provider}/{activeRoute.model}
      </Text>
    </Box>
  );
}

export async function launchChatTui(options: LaunchOptions): Promise<void> {
  await new Promise<void>((resolve) => {
    const app = render(<ChatApp {...options} onExit={resolve} />);

    app.waitUntilExit().then(resolve).catch(resolve);
  });
}
