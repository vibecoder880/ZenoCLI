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
  { command: "/exit", description: "Quit ZenoCLI", category: "mode" }
];

/** In-memory recency tracker (session-scoped) for recently used slash commands. */
const recentCommands: string[] = [];

/** Mark a command as used so it floats to the top of its group. */
export function markSlashCommandUsed(command: string): void {
  const index = recentCommands.indexOf(command);
  if (index !== -1) {
    recentCommands.splice(index, 1);
  }
  recentCommands.unshift(command);
  if (recentCommands.length > 10) {
    recentCommands.pop();
  }
}

/** Rank a command: lower = higher up (recent commands first, then alpha). */
function recencyRank(command: string): number {
  const index = recentCommands.indexOf(command);
  return index === -1 ? recentCommands.length + 100 : index;
}

const CATEGORY_ORDER: SlashCommandCategory[] = ["mode", "session", "debug", "info"];

/**
 * Build the full command list: built-ins plus any custom commands declared in
 * config (`[commands]`, e.g. `/refactor` -> prompt template).
 */
export function buildSlashCommands(config?: { commands?: Record<string, { prompt: string; model?: string }> }): SlashCommand[] {
  const custom: SlashCommand[] = Object.entries(config?.commands ?? {}).map(([name, def]) => ({
    command: `/${name}`,
    description: def.prompt.replace(/\s+/g, " ").slice(0, 60),
    category: "info",
  }));
  return [...SLASH_COMMANDS, ...custom];
}

export function filterSlashCommands(input: string, config?: { commands?: Record<string, { prompt: string; model?: string }> }): SlashCommand[] {
  if (!input.startsWith("/")) {
    return [];
  }

  const query = input.slice(1).trim().toLowerCase();
  const all = buildSlashCommands(config);

  const matches = query
    ? all.filter(({ command }) => command.slice(1).includes(query))
    : all;

  // Copy before sorting so the underlying list is never mutated.
  return [...matches].sort((a, b) => {
    const categoryDelta = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (categoryDelta !== 0) {
      return categoryDelta;
    }
    return recencyRank(a.command) - recencyRank(b.command);
  });
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
