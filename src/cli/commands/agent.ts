import { runAgentLoop } from "../../agent/loop.js";
import { loadProjectInstructions } from "../../core/context.js";
import { createProvider } from "../../providers/index.js";
import { resolveModelRoute } from "../../providers/router.js";
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
  const route = resolveModelRoute(config, options.model, options.provider);
  const provider = createProvider(route.provider);
  const result = await runAgentLoop({
    provider,
    model: route.model,
    task: options.task,
    maxTurns: options.maxTurns,
    projectInstructions: loadProjectInstructions(options.cwd),
    toolContext: {
      cwd: options.cwd,
      ignore: config.context.ignore
    },
    onEvent: (line) => {
      process.stdout.write(`${line}\n`);
    }
  });

  process.stdout.write(`\n${result.message}\n`);
}
