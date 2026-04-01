#!/usr/bin/env node

import { Command } from "commander";
import { runAuthCommand } from "./cli/commands/auth.js";

const program = new Command();

program
  .name("neuro")
  .description("Professional terminal coding agent")
  .option("-m, --model <model>", "Model to use", process.env.OPENAI_MODEL ?? "gpt-4.1-mini")
  .option("-p, --provider <provider>", "Provider to use", "openai")
  .option("--prompt <prompt>", "Run one prompt in the TUI as the initial message");

program
  .command("auth")
  .description("Authentication commands")
  .argument("[action]", "Action to run", "status")
  .action(async (action) => {
    await runAuthCommand(action);
  });

program.action(async (options) => {
  const { launchChatTui } = await import("./cli/tui.js");

  await launchChatTui({
    model: options.model,
    provider: options.provider,
    initialPrompt: options.prompt
  });
});

await program.parseAsync(process.argv);
