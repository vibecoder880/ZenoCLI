export type SlashCommandCategory = "mode" | "session" | "debug" | "info";

export interface SlashCommand {
  command: string;
  description: string;
  category: SlashCommandCategory;
}

export const SLASH_CATEGORY_LABELS: Record<SlashCommandCategory, string> = {
  mode: "Mode",
  session: "Session",
  debug: "Debug",
  info: "Info"
};

export const SLASH_COMMANDS: SlashCommand[] = [
  { command: "/help", description: "Show command usage", category: "info" },
  { command: "/init", description: "Explain workspace bootstrap", category: "info" },
  { command: "/chat", description: "Chat mode — send prompts", category: "mode" },
  { command: "/agent", description: "Agent mode — autonomous task execution", category: "mode" },
  { command: "/model", description: "Switch active model", category: "info" },
  { command: "/auth", description: "Manage provider login", category: "info" },
  { command: "/clear", description: "Clear conversation", category: "session" },
  { command: "/history", description: "Show recent history", category: "info" },
  { command: "/cost", description: "Show token usage", category: "debug" },
  { command: "/health", description: "Check provider health", category: "debug" },
  { command: "/models", description: "List aliases and models", category: "debug" },
  { command: "/config", description: "Show config summary", category: "info" },
  { command: "/version", description: "Show installed version", category: "info" },
  { command: "/context", description: "Show context window usage", category: "debug" },
  { command: "/compact", description: "Force context compaction", category: "debug" },
  { command: "/memory", description: "Show auto-memory", category: "session" },
  { command: "/resume", description: "Resume previous session", category: "session" },
  { command: "/fork", description: "Fork current session", category: "session" },
  { command: "/permission", description: "Cycle permission mode", category: "mode" },
  { command: "/undo", description: "Undo last file edit (checkpoint)", category: "session" },
  { command: "/exit", description: "Quit NeuroCLI", category: "mode" }
];

export function filterSlashCommands(input: string): SlashCommand[] {
  if (!input.startsWith("/")) {
    return [];
  }

  const query = input.slice(1).trim().toLowerCase();

  if (!query) {
    return SLASH_COMMANDS;
  }

  return SLASH_COMMANDS.filter(({ command }) => command.slice(1).includes(query));
}

export function findSlashCommand(input: string): SlashCommand | undefined {
  const normalized = input.trim().toLowerCase();
  return SLASH_COMMANDS.find((entry) => entry.command === normalized);
}

export function getSlashCommandsByCategory(): Record<SlashCommandCategory, SlashCommand[]> {
  const grouped: Record<SlashCommandCategory, SlashCommand[]> = {
    mode: [],
    session: [],
    debug: [],
    info: []
  };

  for (const command of SLASH_COMMANDS) {
    grouped[command.category].push(command);
  }

  return grouped;
}
