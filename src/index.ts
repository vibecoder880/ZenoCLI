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
import { runDoctorCommand } from "./cli/commands/doctor.js";
import {
  runCostCommand,
  runHistoryClearCommand,
  runHistoryListCommand,
  runHistoryShowCommand
} from "./cli/commands/history.js";
import { runInitCommand } from "./cli/commands/init.js";
import { runReviewCommand } from "./cli/commands/review.js";
import { runHealthCommand, runModelsCommand } from "./cli/commands/providers.js";
import { runVersionCommand } from "./cli/commands/version.js";
import { loadConfig } from "./storage/config.js";

const program = new Command();
const config = loadConfig();

program
  .name("zeno")
  .description("Professional terminal coding agent")
  .option("-m, --model <model>", "Model or alias to use", process.env.OPENAI_MODEL ?? config.default.model)
  .option("-p, --provider <provider>", "Provider to use", config.default.provider)
  .option("--cwd <cwd>", "Working directory", process.cwd())
  .option("--prompt <prompt>", "Run one prompt in the TUI as the initial message")
  .option("--continue", "Resume the last session")
  .option("--resume <sessionId>", "Resume a specific session by ID");

registerAuthCommands(program);

program
  .command("chat")
  .description("Run a one-shot chat request")
  .argument("<prompt>", "Prompt to send")
  .option("-m, --model <model>", "Model or alias to use")
  .option("-p, --provider <provider>", "Provider override")
  .option("--cwd <cwd>", "Working directory", process.cwd())
  .option("--no-stream", "Disable streaming output")
  .option("--non-interactive", "Run headless for CI/CD: plain stdout, no TTY decorations")
  .option("--pipe", "Alias for --non-interactive (pipe-friendly output)")
  .action(async (prompt: string, options: { model?: string; provider?: string; cwd: string; stream?: boolean; nonInteractive?: boolean; pipe?: boolean }) => {
    await runChatCommand({
      prompt,
      model: options.model,
      provider: options.provider,
      cwd: options.cwd,
      stream: options.stream,
      nonInteractive: Boolean(options.nonInteractive || options.pipe)
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
  .option("--non-interactive", "Run headless for CI/CD: plain stdout, no TTY decorations")
  .option("--pipe", "Alias for --non-interactive (pipe-friendly output)")
  .option("--retries <count>", "Retries on retryable provider errors", "0")
  .action(async (task: string, options: { model?: string; provider?: string; cwd: string; maxTurns: string; nonInteractive?: boolean; pipe?: boolean; retries?: string }) => {
    await runAgentCommand({
      task,
      model: options.model,
      provider: options.provider,
      cwd: options.cwd,
      maxTurns: Number(options.maxTurns),
      nonInteractive: Boolean(options.nonInteractive || options.pipe),
      maxRetries: Number(options.retries ?? "0")
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

    throw new Error("Usage: zeno history list|show <id>|clear [--limit <count>]");
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
  .description("Show or update ZenoCLI config")
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

    throw new Error("Usage: zeno config show | zeno config set <key> <value>");
  });

program
  .command("context")
  .description("Show or manage project ZENO.md instructions")
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

    throw new Error("Usage: zeno context show|init | zeno context set <content>");
  });

program
  .command("doctor")
  .description("Inspect runtime, config, credentials, and release readiness")
  .argument("[targetCwd]", "Optional working directory")
  .action(async (targetCwd?: string) => {
    await runDoctorCommand(targetCwd ?? process.cwd());
  });

program
  .command("review")
  .description("Run the code-review agent over a target or git diff")
  .argument("[target]", "File or directory to review")
  .option("--diff <ref>", "Review changed files vs a git ref (e.g. HEAD~1)")
  .option("--cwd <cwd>", "Working directory", process.cwd())
  .option("--non-interactive", "Headless output; exit 1 when findings exist")
  .option("--pipe", "Alias for --non-interactive")
  .action(async (target: string | undefined, options: { diff?: string; cwd: string; nonInteractive?: boolean; pipe?: boolean }) => {
    await runReviewCommand({
      target,
      diff: options.diff,
      cwd: options.cwd,
      nonInteractive: Boolean(options.nonInteractive || options.pipe)
    });
  });

program
  .command("init")
  .description("Bootstrap a workspace with ZENO.md and .env.example")
  .argument("[targetCwd]", "Optional target directory")
  .action((targetCwd?: string) => {
    runInitCommand(targetCwd ?? process.cwd());
  });

program
  .command("version")
  .description("Print the installed ZenoCLI version")
  .action(() => {
    runVersionCommand();
  });

program.action(async (options) => {
  const { launchChatTui } = await import("./cli/tui.js");

  await launchChatTui({
    model: options.model,
    provider: options.provider,
    cwd: options.cwd,
    initialPrompt: options.prompt,
    continueSession: Boolean(options.continue),
    resumeSessionId: options.resume,
  });
});

await program.parseAsync(process.argv);
