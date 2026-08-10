import { runAgentLoop } from "../../agent/loop.js";
import { AuthProfileStore } from "../../auth/auth-profiles.js";
import { refreshOAuthIfNeeded } from "../../auth/refresh.js";
import { createProvider } from "../../providers/index.js";
import { selectUsableRoute } from "../../providers/router-fallback.js";
import { loadConfig } from "../../storage/config.js";

interface RunAgentOptions {
  task: string;
  model?: string;
  provider?: string;
  cwd: string;
  maxTurns?: number;
  /** Run non-interactively (plain stdout, no TTY decorations). */
  nonInteractive?: boolean;
  /** Abort signal; Ctrl+C or --timeout wiring. */
  signal?: AbortSignal;
  /** Max provider retries on retryable errors (default: 0). */
  maxRetries?: number;
}

export async function runAgentCommand(options: RunAgentOptions): Promise<void> {
  // In headless (CI/CD / piped) runs, abort on SIGINT so a cancelled job ends cleanly.
  const signal = options.signal ?? (options.nonInteractive ? installSigintAbort() : undefined);

  const config = loadConfig();
  const selection = selectUsableRoute(config, undefined, options.model, options.provider);
  const route = selection.route;

  // Refresh a near-expiry OAuth access token before the provider is created.
  await refreshOAuthIfNeeded(new AuthProfileStore(), route.provider);

  const provider = createProvider(route.provider);

  if (selection.warning) {
    process.stdout.write(`${selection.warning}\n`);
  }

  if (!options.nonInteractive) {
    process.stdout.write(`Agent: ${route.provider}/${route.model}\n`);
    process.stdout.write(`Task: ${options.task}\n\n`);
  }

  const result = await runAgentLoop({
    provider,
    model: route.model,
    task: options.task,
    maxTurns: options.maxTurns,
    signal,
    maxRetries: options.maxRetries,
    toolContext: {
      cwd: options.cwd,
      ignore: config.context.ignore,
    },
    onEvent: (event) => {
      if (options.nonInteractive) {
        // Headless output stays machine-readable: stream text as-is, and only
        // surface errors (to stderr) without decorative prefixes.
        if (event.type === "stream") {
          process.stdout.write(event.content);
        }
        if (event.type === "error") {
          process.stderr.write(`[agent] ${event.content}\n`);
        }
        return;
      }
      switch (event.type) {
        case "thought":
          process.stdout.write(`> ${event.content}\n`);
          break;
        case "tool_start":
          process.stdout.write(`  ↳ ${event.toolName}(${Object.entries(event.toolArgs ?? {}).map(([k, v]) => `${k}=${String(v).slice(0, 50)}`).join(", ")})\n`);
          break;
        case "tool_result":
          process.stdout.write(`  ✓ ${event.toolName}: ${event.content.slice(0, 100)}\n`);
          break;
        case "compact":
          process.stdout.write(`  ⟳ Context compacted: ${event.content}\n`);
          break;
        case "error":
          process.stdout.write(`  ✗ Error: ${event.content}\n`);
          break;
        case "stream":
          process.stdout.write(event.content);
          break;
      }
    },
  });

  // Final result: plain message to stdout, richer summary only outside headless.
  process.stdout.write(options.nonInteractive ? `${result.message}\n` : `\n${result.message}\n`);
  if (!options.nonInteractive) {
    process.stdout.write(`\n---\nTurns: ${result.turns} | Tokens: ${result.totalTokens} | Tools: ${result.toolsUsed.join(", ") || "none"}\n`);
  }

  // In non-interactive runs, an aborted/cancelled loop should fail the job.
  if (options.nonInteractive && result.aborted) {
    process.exitCode = 130; // SIGINT convention
  }
}

/** Install a SIGINT → abort controller so Ctrl+C cancels the loop cleanly. */
function installSigintAbort(): AbortSignal {
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  return controller.signal;
}
