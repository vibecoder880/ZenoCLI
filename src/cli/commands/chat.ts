import { loadProjectInstructions } from "../../core/context.js";
import { collectProviderText } from "../../core/stream.js";
import { createProvider } from "../../providers/index.js";
import { resolveModelRoute } from "../../providers/router.js";
import { loadConfig } from "../../storage/config.js";

interface RunChatOptions {
  prompt: string;
  model?: string;
  provider?: string;
  cwd?: string;
  stream?: boolean;
}

export async function runChatCommand(options: RunChatOptions): Promise<void> {
  const config = loadConfig();
  const route = resolveModelRoute(config, options.model, options.provider);
  const aiProvider = createProvider(route.provider);
  const projectInstructions = loadProjectInstructions(options.cwd);
  const messages = [
    ...(projectInstructions
      ? [{ role: "system" as const, content: `Project instructions:\n${projectInstructions}` }]
      : []),
    { role: "user" as const, content: options.prompt }
  ];

  const result = await collectProviderText(aiProvider, route.model, messages, (chunk) => {
    if (options.stream ?? config.default.streaming) {
      process.stdout.write(chunk);
    }
  });

  if (!(options.stream ?? config.default.streaming)) {
    process.stdout.write(result.text);
  }

  process.stdout.write("\n");
}
