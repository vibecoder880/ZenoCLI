export interface SlashCommand {
  command: string;
  description: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { command: "/help", description: "Show command usage" },
  { command: "/model", description: "Switch active model" },
  { command: "/auth", description: "Manage provider login" },
  { command: "/clear", description: "Clear conversation" },
  { command: "/cost", description: "Show token usage" },
  { command: "/context", description: "Set file context" },
  { command: "/compact", description: "Summarize history" },
  { command: "/exit", description: "Quit NeuroCLI" }
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
