import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, render, useApp, useInput } from "ink";
import { execSync } from "node:child_process";
import { AgentStatus } from "./components/AgentStatus.js";
import { Header } from "./components/Header.js";
import { MessageList, type ChatLine } from "./components/MessageList.js";
import { Footer } from "./components/Footer.js";
import { SlashMenu } from "./components/SlashMenu.js";
import { Prompt } from "./components/Prompt.js";
import { WelcomeBanner } from "./components/WelcomeBanner.js";
import { useFirstRun } from "./hooks/useFirstRun.js";
import { AuthProfileStore, getKnownProviders } from "../auth/auth-profiles.js";
import { refreshOAuthIfNeeded } from "../auth/refresh.js";
import { createProvider } from "../providers/index.js";
import type { ChatMessage } from "../providers/base.js";
import { estimateCostUsd } from "../providers/pricing.js";
import { selectUsableRoute } from "../providers/router-fallback.js";
import { filterSlashCommands, findSlashCommand, markSlashCommandUsed, SLASH_COMMANDS } from "./slash-commands.js";
import { ModelsDialog, setActiveModel } from "./components/ModelsDialog.js";
import { resolveTheme, ThemeProvider } from "./theme.js";
import { collectProviderText } from "../core/stream.js";
import { resolveModelRoute } from "../providers/router.js";
import { getConfigPathname, loadConfig } from "../storage/config.js";import { appendHistoryEntry, listHistoryEntries, recordBudgetSpend, summarizeTokenUsage } from "../storage/history.js";
import { listProviderCatalog, tryCreateProvider } from "../providers/index.js";
import { ContextManager } from "../core/context-manager.js";
import { getMergedInstructions, getInstructionsSummary } from "../core/zeno-md.js";
import { getMemorySummary, loadMemory, readFullMemory } from "../core/memory.js";
import { SessionReader, SessionWriter, listSessions } from "../core/session.js";
import { ForkDialog } from "./components/ForkDialog.js";
import { runAgentLoop, type AgentEvent } from "../agent/loop.js";
import { CheckpointManager } from "../safety/checkpoints.js";
import { ALL_PERMISSION_MODES, nextPermissionMode, permissionModeLabel, type PermissionMode } from "../safety/permissions.js";
import { Shell as V2Shell } from "../ui/app/Shell.js";
import { VERSION } from "../ui/components/Header.js";

interface LaunchOptions {
  model: string;
  provider: string;
  cwd: string;
  initialPrompt?: string;
  /** Resume a previous session. */
  continueSession?: boolean;
  /** Resume a specific session by ID. */
  resumeSessionId?: string;
}

interface ChatAppProps extends LaunchOptions {
  onExit: () => void;
}

type AppMode = "chat" | "agent";
type ScreenMode = "welcome" | "chat";

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
  const [mode, setMode] = useState<AppMode>("chat");
  const [modelsOpen, setModelsOpen] = useState(false);
  const [forkOpen, setForkOpen] = useState(false);
  const [forkEntries, setForkEntries] = useState<import("../core/session.js").SessionEntry[]>([]);
  const [screen, setScreen] = useState<ScreenMode>("welcome");
  const [historyCount, setHistoryCount] = useState(() => listHistoryEntries(200).length);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(config.permission?.mode ?? "default");
  const slashCommands = useMemo(() => filterSlashCommands(input, config), [input, config]);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);

  // Context manager and session (persisted across turns)
  const contextManagerRef = useRef<ContextManager | null>(null);
  const sessionRef = useRef<SessionWriter | null>(null);
  const pendingMessagesRef = useRef<string[]>([]);
  const checkpointsRef = useRef<CheckpointManager>(new CheckpointManager());

  // First-run detection
  const firstRun = useFirstRun(config);
  const providerStatus = useMemo(() => {
    const store = new AuthProfileStore();
    return getKnownProviders(config).map((slug) => ({
      slug,
      status: store.getActiveProfile(slug) ? ("ok" as const) : ("missing" as const)
    }));
  }, [config]);

  useEffect(() => {
    setSelectedSlashIndex(0);
  }, [slashCommands.length]);

  // Read package version once
  useEffect(() => {
    // Version is read at module load by Header; nothing async to do here.
  }, []);

  // Initialize session and context on mount
  useEffect(() => {
    let route = requestedRoute;
    let warning: string | undefined;

    try {
      const selection = selectUsableRoute(config, undefined, model, provider);
      route = selection.route;
      warning = selection.warning;
    } catch (err) {
      // No provider available (no auth). Show banner, keep TUI alive.
      warning = `⚠ No provider available: ${err instanceof Error ? err.message : String(err)}`;
    }

    setActiveRoute(route);

    const session = new SessionWriter(cwd, route.model, route.provider);
    sessionRef.current = session;

    const ctx = new ContextManager(config.context.maxTokens);
    contextManagerRef.current = ctx;

    const memory = loadMemory(cwd);
    if (memory) {
      ctx.addSystem(`Memory:\n${memory}`);
    }

    const instructions = getMergedInstructions(cwd);
    if (instructions) {
      ctx.addSystem(`Project instructions:\n${instructions}`);
    }

    session.append({
      type: "system",
      content: "Session started",
      timestamp: new Date().toISOString()
    });

    setAgentLines([
      `Session ${session.id}`,
      `Provider ${route.provider}/${route.model}`,
      warning,
      "Ready. Type a prompt or /help for commands."
    ].filter((line): line is string => Boolean(line)));

    return () => {
      session.close();
    };
  }, []);

  const executeSlashCommand = useCallback(async (value: string): Promise<boolean> => {
    const command = findSlashCommand(value);

    // Custom slash command from config ([commands]): send the prompt template.
    if (!command && value.startsWith("/")) {
      const name = value.slice(1).trim().split(/\s+/)[0];
      const custom = config.commands?.[name];
      if (custom) {
        setInput("");
        const extraArgs = value.slice(1).trim().split(/\s+/).slice(1).join(" ");
        const prompt = custom.prompt + (extraArgs ? `\n${extraArgs}` : "");
        setAgentLines([`Running custom command /${name}`]);
        await submitPrompt(prompt);
        return true;
      }
    }

    if (!command) {
      return false;
    }

    if (command.command === "/exit") {
      sessionRef.current?.close();
      exit();
      onExit();
      return true;
    }

    if (command.command === "/clear") {
      setMessages([]);
      contextManagerRef.current = new ContextManager(config.context.maxTokens);
      setAgentLines(["Conversation cleared"]);
      setInput("");
      return true;
    }

    if (command.command === "/help") {
      setAgentLines([SLASH_COMMANDS.map((entry) => entry.command).join("  ")]);
      setInput("");
      return true;
    }

    if (command.command === "/chat") {
      setMode("chat");
      setAgentLines(["Switched to chat mode."]);
      setInput("");
      return true;
    }

    if (command.command === "/agent") {
      setMode("agent");
      setAgentLines(["Switched to agent mode — autonomous task execution."]);
      setInput("");
      return true;
    }

    if (command.command === "/init") {
      setAgentLines([
        "Workspace bootstrap runs from the terminal command.",
        "Run: zeno init"
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
        getKnownProviders(config).map((providerName) => {
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
      setModelsOpen(true);
      setInput("");
      return true;
    }

    if (command.command === "/config") {
      setAgentLines([
        `Config path ${getConfigPathname()}`,
        `default.model ${config.default.model}`,
        `default.provider ${config.default.provider}`,
        `default.streaming ${config.default.streaming}`,
        `Permission mode: ${permissionModeLabel(permissionMode)}`
      ]);
      setInput("");
      return true;
    }

    if (command.command === "/permission") {
      const idx = ALL_PERMISSION_MODES.indexOf(permissionMode);
      const next = ALL_PERMISSION_MODES[(idx + 1) % ALL_PERMISSION_MODES.length];
      setPermissionMode(next);
      setAgentLines([
        `Permission mode: ${permissionModeLabel(permissionMode)}`,
        `Switched to: ${permissionModeLabel(next)}`,
        `Tip: also cycle with Shift+Tab during prompts`
      ]);
      setInput("");
      return true;
    }

    if (command.command === "/undo") {
      const result = checkpointsRef.current.undo();
      if (result) {
        setAgentLines([
          `Undo: ${result.checkpoint.toolName} → ${result.checkpoint.filePath}`,
          `Restored previous content (${result.checkpoint.previousContent?.length ?? 0} chars)`
        ]);
      } else {
        setAgentLines(["No checkpoints to undo."]);
      }
      setInput("");
      return true;
    }

    if (command.command === "/version") {
      setAgentLines(["Run `zeno version` in the terminal to print the installed package version."]);
      setInput("");
      return true;
    }

    if (command.command === "/context") {
      const ctx = contextManagerRef.current;
      if (ctx) {
        const instructions = getInstructionsSummary(cwd);
        setAgentLines([ctx.getSummary(), "", instructions]);
      } else {
        const instructions = getMergedInstructions(cwd);
        setAgentLines(
          instructions
            ? [`Instructions loaded (${instructions.length} bytes)`, instructions.slice(0, 300)]
            : [`No ZENO.md found`]
        );
      }
      setInput("");
      return true;
    }

    if (command.command === "/compact") {
      const ctx = contextManagerRef.current;
      if (ctx) {
        const result = ctx.compact();
        setAgentLines([
          result.compacted
            ? `Compacted: ${result.tokensFreed} tokens freed (${result.tokensBefore} → ${result.tokensAfter})`
            : "No compaction needed.",
          ctx.getSummary()
        ]);
      } else {
        const compactText = messages
          .slice(-6)
          .map((message) => `${message.role}: ${message.content.slice(0, 80)}`)
          .join(" | ");
        setAgentLines([compactText || "Conversation is empty."]);
      }
      setInput("");
      return true;
    }

    if (command.command === "/memory") {
      const summary = getMemorySummary(cwd);
      const full = readFullMemory(cwd);
      const lines = [summary];
      if (full.project) {
        lines.push("", "--- Project Memory ---", full.project.slice(0, 500));
      }
      if (full.global) {
        lines.push("", "--- Global Memory ---", full.global.slice(0, 300));
      }
      setAgentLines(lines);
      setInput("");
      return true;
    }

    if (command.command === "/resume") {
      const sessions = listSessions(cwd);
      if (sessions.length === 0) {
        setAgentLines(["No previous sessions found."]);
      } else {
        const recent = sessions.slice(0, 5);
        setAgentLines([
          "Recent sessions:",
          ...recent.map((s) => `  ${s.id} (${s.model}, ${s.entryCount} entries, ${new Date(s.updatedAt).toLocaleString()})`),
          "Use: zeno --resume <id> to resume a session."
        ]);
      }
      setInput("");
      return true;
    }

    if (command.command === "/fork") {
      const session = sessionRef.current;
      if (session) {
        try {
          const reader = new SessionReader(session.id, cwd);
          const entries = reader.getEntries();
          if (entries.length === 0) {
            setAgentLines(["No messages to fork yet."]);
            setInput("");
            return true;
          }
          setForkEntries(entries);
          setForkOpen(true);
        } catch (err) {
          setAgentLines([`Fork failed: ${err instanceof Error ? err.message : String(err)}`]);
        }
      }
      setInput("");
      return true;
    }

    return false;
  }, [activeRoute, config, cwd, exit, messages, model, onExit, permissionMode, provider, requestedRoute, sessionCost, tokenCount]);

  useInput((inputChar, key) => {
    if (isBusy && !key.escape) return;

    // Esc: dismiss welcome or exit
    if (key.escape) {
      if (screen === "welcome") {
        setScreen("chat");
        return;
      }
      if (isBusy) {
        pendingMessagesRef.current.push("[interrupt]");
      } else {
        sessionRef.current?.close();
        exit();
        onExit();
      }
      return;
    }

    // Shift+Tab: cycle permission mode
    if (key.tab && key.shift) {
      setPermissionMode((current) => {
        const next = nextPermissionMode(current);
        setAgentLines([
          permissionModeLabel(current),
          "Switched to: " + permissionModeLabel(next),
          "Tip: use /permission to cycle too"
        ]);
        return next;
      });
      return;
    }

    if (slashCommands.length === 0) {
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

  const submitPrompt = useCallback(async (rawValue: string): Promise<void> => {
    const value = rawValue.trim();

    if (!value || isBusy) {
      return;
    }

    if (value.startsWith("/")) {
      const executed = await executeSlashCommand(value);
      if (executed) {
        markSlashCommandUsed(value.trim().split(/\s+/)[0]);
        return;
      }

      setAgentLines([`Unknown command: ${value}. Type /help for available commands.`]);
      setInput("");
      return;
    }

    // Dismiss welcome on first prompt
    if (screen === "welcome") {
      setScreen("chat");
    }

    setIsBusy(true);
    setInput("");

    let selection: ReturnType<typeof selectUsableRoute> | null = null;
    try {
      selection = selectUsableRoute(config, undefined, model, provider);
      setActiveRoute(selection.route);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const errorLine = createLine("assistant", `Error: ${message}\nRun: zeno auth <provider> to configure credentials.`);
      setMessages((prev) => [...prev, errorLine]);
      setAgentLines([`✗ ${message}`]);
      setIsBusy(false);
      return;
    }
    if (!selection) {
      setIsBusy(false);
      return;
    }
    const route = selection.route;

    const userLine = createLine("user", value);
    setMessages((prev) => [...prev, userLine]);

    try {
      // Refresh a near-expiry OAuth access token before the provider is created.
      await refreshOAuthIfNeeded(new AuthProfileStore(), route.provider);

      const aiProvider = createProvider(route.provider);

      if (mode === "agent") {
        setAgentLines([
          `Agent: ${route.provider}/${route.model}`,
          "Working..."
        ]);

        const result = await runAgentLoop({
          provider: aiProvider,
          model: route.model,
          task: value,
          toolContext: {
            cwd,
            ignore: config.context.ignore,
            askUser: async (question: string) => `[User asked: ${question}]`
          },
          contextManager: contextManagerRef.current ?? undefined,
          session: sessionRef.current ?? undefined,
          permission: { mode: permissionMode, autoApprove: config.permission?.autoApprove ?? {} },
          checkpoints: checkpointsRef.current,
          onPermissionPrompt: async () => true,
          onEvent: (event: AgentEvent) => {
            switch (event.type) {
              case "tool_start":
                setAgentLines([`> ${event.toolName}`, event.content]);
                break;
              case "tool_result":
                setAgentLines([`+ ${event.toolName}`, event.content.slice(0, 200)]);
                break;
              case "compact":
                setAgentLines(["Context compacted", event.content]);
                break;
              case "final":
                setAgentLines(["Response complete", event.tokens ? `${event.tokens} tokens` : ""]);
                break;
              case "error":
                setAgentLines([`✗ Error: ${event.content}`]);
                break;
              case "permission":
                setAgentLines([`${event.content}`]);
                break;
              case "checkpoint":
                setAgentLines([`💾 ${event.content}`]);
                break;
            }
          },
          onStream: (chunk) => {
            setMessages((prev) => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg && lastMsg.role === "assistant") {
                return [
                  ...prev.slice(0, -1),
                  { ...lastMsg, content: lastMsg.content + chunk }
                ];
              }
              const assistantLine = createLine("assistant", chunk);
              return [...prev, assistantLine];
            });
          },
          pendingUserMessages: pendingMessagesRef.current
        });

        const responseLine = createLine("assistant", result.message);
        setMessages((prev) => [...prev, responseLine]);
        setTokenCount((current) => current + result.totalTokens);

        const requestCost =
          estimateCostUsd(route.provider, route.model, result.totalTokens, result.totalTokens / 2) ?? 0;
        setSessionCost((current) => Number((current + requestCost).toFixed(6)));

        setAgentLines([
          `Done in ${result.turns} turns`,
          `Tools used: ${result.toolsUsed.join(", ") || "none"}`,
          `Tokens: ${result.totalTokens}`
        ]);

        appendHistoryEntry({
          cwd,
          provider: route.provider,
          model: route.model,
          prompt: value,
          response: result.message,
          totalTokens: result.totalTokens,
          inputTokens: result.totalTokens,
          outputTokens: result.totalTokens,
          estimatedCostUsd: requestCost
        });
      } else {
        setAgentLines([
          "Preparing request",
          selection.warning,
          `Provider ${route.provider}`,
          `Model ${route.model}`
        ].filter((line): line is string => Boolean(line)));

        const assistantLine = createLine("assistant", "");
        setMessages((prev) => [...prev, assistantLine]);

        const projectInstructions = getMergedInstructions(cwd);
        const memoryContent = loadMemory(cwd);

        const enrichedMessages: ChatMessage[] = [
          ...(projectInstructions
            ? [{ role: "system" as const, content: `Project instructions:\n${projectInstructions}` }]
            : []),
          ...(memoryContent
            ? [{ role: "system" as const, content: `Memory:\n${memoryContent}` }]
            : []),
          ...[userLine].map((m) => ({ role: m.role, content: m.content }))
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
        if (requestCost > 0) {
          recordBudgetSpend(requestCost);
        }
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
      }

      setHistoryCount(listHistoryEntries(200).length);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown provider error";
      const errorLine = createLine("assistant", `Error: ${message}`);
      setMessages((prev) => [...prev, errorLine]);
      setAgentLines([`✗ ${message}`]);
    } finally {
      setIsBusy(false);
    }
  }, [activeRoute, config, cwd, executeSlashCommand, isBusy, messages, mode, model, provider, screen, sessionCost, tokenCount]);

  useEffect(() => {
    if (initialPrompt) {
      void submitPrompt(initialPrompt);
    }
  }, []);

  const showWelcome = screen === "welcome" && firstRun.isFirstRun;
  const v2 = Boolean(process.env.ZENO_UI_V2);
  // Git branch for the v2 header statusline; best-effort, read on each render.
  const branchName = useMemo(() => {
    if (!cwd) return "";
    try {
      return execSync("git branch --show-current", { cwd }).toString().trim();
    } catch {
      return "";
    }
  }, [cwd]);

  if (v2) {
    // Zeno UI v2 shell (Phase 2) — opt-in via ZENO_UI_V2=1 while the v1 TUI
    // remains the default. The v2 shell is presentation-only; it reuses the
    // same messages/route state the v1 tree renders.
    const contextPct =
      tokenCount > 0
        ? Math.min(100, Math.round((tokenCount / (config.context.maxTokens || 128000)) * 100))
        : 0;
    return (
      <V2Shell
        version={VERSION}
        provider={activeRoute.provider}
        model={activeRoute.model}
        branch={branchName}
        cwd={cwd}
        contextPct={contextPct}
        messages={messages}
        input={input}
        busy={isBusy}
        firstRun={showWelcome}
        providersReady={providerStatus.filter((p) => p.status === "ok").length}
        onInputChange={setInput}
        onSubmit={(value) => {
          void submitPrompt(value);
        }}
      />
    );
  }

  const palette = resolveTheme(config);
  return (
    <ThemeProvider palette={palette}>
    <Box flexDirection="column">
      <Header
        model={activeRoute.model}
        provider={activeRoute.provider}
        tokens={tokenCount}
        historyEntries={historyCount}
        sessionId={sessionRef.current?.id ?? "loading"}
        mode={mode}
        permissionMode={permissionModeLabel(permissionMode)}
        sessionCost={sessionCost}
      />
      {showWelcome ? (
        <WelcomeBanner
          cwd={cwd}
          providers={providerStatus}
        />
      ) : null}
      <AgentStatus lines={agentLines} />
      <MessageList messages={messages} />
      {modelsOpen ? (
        <ModelsDialog
          onClose={() => setModelsOpen(false)}
          onSelect={(model) => {
            setActiveModel(model);
            setModelsOpen(false);
            setAgentLines([`Model set to ${model}`]);
          }}
        />
      ) : null}
      {forkOpen ? (
        <ForkDialog
          sessionId={sessionRef.current?.id ?? ""}
          cwd={cwd}
          entries={forkEntries}
          onClose={() => setForkOpen(false)}
          onFork={(writer) => {
            sessionRef.current = writer;
            setForkOpen(false);
            setAgentLines([`Session forked to ${writer.id}`]);
          }}
        />
      ) : null}
      {!modelsOpen && !forkOpen && input.startsWith("/") ? (
        <SlashMenu commands={slashCommands} selectedIndex={selectedSlashIndex} />
      ) : null}
      <Prompt
        value={input}
        placeholder={isBusy ? "Working... (Esc to interrupt)" : `Ask ZenoCLI to help (${mode} mode)`}
        disabled={isBusy}
        onChange={setInput}
        onSubmit={(value) => {
          void submitPrompt(value);
        }}
      />
      <Footer isBusy={isBusy} isMultiLine={input.includes("\n")} />
    </Box>
    </ThemeProvider>
  );
}

export async function launchChatTui(options: LaunchOptions): Promise<void> {
  await new Promise<void>((resolve) => {
    const app = render(<ChatApp {...options} onExit={resolve} />);

    app.waitUntilExit().then(resolve).catch(resolve);
  });
}
