#!/usr/bin/env node

import { Command } from "commander";
import { runAgentCommand } from "./cli/commands/agent.js";
import { registerAuthCommands } from "./cli/commands/auth.js";
import { runChatCommand } from "./cli/commands/chat.js";
import { runConfigSetCommand, runConfigShowCommand } from "./cli/commands/config.js";
import {
  runContextInitCommand,
  runContextSetCommand,
  runContextShowCommand
} from "./cli/commands/context.js";
import {
  runCostCommand,
  runHistoryClearCommand,
  runHistoryListCommand,
  runHistoryShowCommand
} from "./cli/commands/history.js";
import { runHealthCommand, runModelsCommand } from "./cli/commands/providers.js";
import { loadConfig } from "./storage/config.js";

const program = new Command();
const config = loadConfig();

program
  .name("neuro")
  .description("Professional terminal coding agent")
  .option("-m, --model <model>", "Model or alias to use", process.env.OPENAI_MODEL ?? config.default.model)
  .option("-p, --provider <provider>", "Provider to use", config.default.provider)
  .option("--cwd <cwd>", "Working directory", process.cwd())
  .option("--prompt <prompt>", "Run one prompt in the TUI as the initial message");

registerAuthCommands(program);

program
  .command("chat")
  .description("Run a one-shot chat request")
  .argument("<prompt>", "Prompt to send")
  .option("-m, --model <model>", "Model or alias to use")
  .option("-p, --provider <provider>", "Provider override")
  .option("--cwd <cwd>", "Working directory", process.cwd())
  .option("--no-stream", "Disable streaming output")
  .action(async (prompt: string, options: { model?: string; provider?: string; cwd: string; stream?: boolean }) => {
    await runChatCommand({
      prompt,
      model: options.model,
      provider: options.provider,
      cwd: options.cwd,
      stream: options.stream
    });
  });

program
  .command("agent")
  .description("Run the local tool-using agent loop")
  .argument("<task>", "Task to complete")
  .option("-m, --model <model>", "Model or alias to use")
  .option("-p, --provider <provider>", "Provider override")
  .option("--cwd <cwd>", "Working directory", process.cwd())
  .option("--max-turns <count>", "Maximum reasoning turns", "8")
  .action(async (task: string, options: { model?: string; provider?: string; cwd: string; maxTurns: string }) => {
    await runAgentCommand({
      task,
      model: options.model,
      provider: options.provider,
      cwd: options.cwd,
      maxTurns: Number(options.maxTurns)
    });
  });

program
  .command("history")
  .description("Inspect stored chat history")
  .argument("[action]", "list, show, or clear", "list")
  .argument("[entryId]", "History entry id for show")
  .option("--limit <count>", "Maximum entries to show", "10")
  .action((action: string, entryId: string | undefined, options: { limit: string }) => {
    if (action === "list") {
      runHistoryListCommand(Number(options.limit));
      return;
    }

    if (action === "show" && entryId) {
      runHistoryShowCommand(entryId);
      return;
    }

    if (action === "clear") {
      runHistoryClearCommand();
      return;
    }

    throw new Error("Usage: neuro history list|show <id>|clear [--limit <count>]");
  });

program
  .command("cost")
  .description("Show tracked token usage")
  .action(() => {
    runCostCommand();
  });

program
  .command("health")
  .description("Check configured provider health")
  .action(async () => {
    await runHealthCommand();
  });

program
  .command("models")
  .description("List configured aliases and provider models")
  .argument("[provider]", "Optional provider slug")
  .action(async (provider?: string) => {
    await runModelsCommand(provider);
  });

program
  .command("config")
  .description("Show or update NeuroCLI config")
  .argument("[action]", "show or set", "show")
  .argument("[key]", "Config key for set")
  .argument("[value]", "Config value for set")
  .action((action: string, key?: string, value?: string) => {
    if (action === "show") {
      runConfigShowCommand();
      return;
    }

    if (action === "set" && key && value) {
      runConfigSetCommand(key, value);
      return;
    }

    throw new Error("Usage: neuro config show | neuro config set <key> <value>");
  });

program
  .command("context")
  .description("Show or manage project NEURO.md instructions")
  .argument("[action]", "show, init, or set", "show")
  .argument("[content]", "Content for context set")
  .option("--cwd <cwd>", "Working directory", process.cwd())
  .action((action: string, content: string | undefined, options: { cwd: string }) => {
    if (action === "show") {
      runContextShowCommand(options.cwd);
      return;
    }

    if (action === "init") {
      runContextInitCommand(options.cwd);
      return;
    }

    if (action === "set" && content !== undefined) {
      runContextSetCommand(options.cwd, content);
      return;
    }

    throw new Error("Usage: neuro context show|init | neuro context set <content>");
  });

program.action(async (options) => {
  const { launchChatTui } = await import("./cli/tui.js");

  await launchChatTui({
    model: options.model,
    provider: options.provider,
    cwd: options.cwd,
    initialPrompt: options.prompt
  });
});

await program.parseAsync(process.argv);
