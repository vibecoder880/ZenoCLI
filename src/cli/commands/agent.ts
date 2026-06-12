import { runAgentLoop } from "../../agent/loop.js";
import { createProvider } from "../../providers/index.js";
import { selectUsableRoute } from "../../providers/router-fallback.js";
import { loadConfig } from "../../storage/config.js";

interface RunAgentOptions {
  task: string;
  model?: string;
  provider?: string;
  cwd: string;
  maxTurns?: number;
}

export async function runAgentCommand(options: RunAgentOptions): Promise<void> {
  const config = loadConfig();
  const selection = selectUsableRoute(config, undefined, options.model, options.provider);
  const route = selection.route;
  const provider = createProvider(route.provider);

  if (selection.warning) {
    process.stdout.write(`${selection.warning}\n`);
  }

  process.stdout.write(`Agent: ${route.provider}/${route.model}\n`);
  process.stdout.write(`Task: ${options.task}\n\n`);

  const result = await runAgentLoop({
    provider,
    model: route.model,
    task: options.task,
    maxTurns: options.maxTurns,
    toolContext: {
      cwd: options.cwd,
      ignore: config.context.ignore,
    },
    onEvent: (event) => {
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

  process.stdout.write(`\n${result.message}\n`);
  process.stdout.write(`\n---\nTurns: ${result.turns} | Tokens: ${result.totalTokens} | Tools: ${result.toolsUsed.join(", ") || "none"}\n`);
}
