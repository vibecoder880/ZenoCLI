import { runAgentLoop } from "../../agent/loop.js";
import { loadProjectInstructions } from "../../core/context.js";
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
