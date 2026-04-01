#!/usr/bin/env node

import { Command } from "commander";
import { runAgentCommand } from "./cli/commands/agent.js";
import { registerAuthCommands } from "./cli/commands/auth.js";
import { runChatCommand } from "./cli/commands/chat.js";
import { runCostCommand, runHistoryCommand } from "./cli/commands/history.js";
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
  .description("Show recent chat history")
  .option("--limit <count>", "Maximum entries to show", "10")
  .action((options: { limit: string }) => {
    runHistoryCommand(Number(options.limit));
  });

program
  .command("cost")
  .description("Show tracked token usage")
  .action(() => {
    runCostCommand();
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
