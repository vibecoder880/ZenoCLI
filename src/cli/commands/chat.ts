import { loadProjectInstructions } from "../../core/context.js";
import { collectProviderText } from "../../core/stream.js";
import { AuthProfileStore } from "../../auth/auth-profiles.js";
import { refreshOAuthIfNeeded } from "../../auth/refresh.js";
import { createProvider } from "../../providers/index.js";
import { estimateCostUsd } from "../../providers/pricing.js";
import { selectUsableRoute } from "../../providers/router-fallback.js";
import { loadConfig } from "../../storage/config.js";
import { appendHistoryEntry, recordBudgetSpend } from "../../storage/history.js";

interface RunChatOptions {
  prompt: string;
  model?: string;
  provider?: string;
  cwd?: string;
  stream?: boolean;
}

export async function runChatCommand(options: RunChatOptions): Promise<void> {
  const config = loadConfig();
  const selection = selectUsableRoute(config, undefined, options.model, options.provider);
  const route = selection.route;

  // Refresh a near-expiry OAuth access token before the provider is created.
  await refreshOAuthIfNeeded(new AuthProfileStore(), route.provider);

  const aiProvider = createProvider(route.provider);
  if (selection.warning) {
    console.log(selection.warning);
  }
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

  appendHistoryEntry({
    cwd: options.cwd ?? process.cwd(),
    provider: route.provider,
    model: route.model,
    prompt: options.prompt,
    response: result.text,
    totalTokens: result.totalTokens,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    estimatedCostUsd: estimateCostUsd(route.provider, route.model, result.inputTokens, result.outputTokens)
  });

  const cost = estimateCostUsd(route.provider, route.model, result.inputTokens, result.outputTokens);
  if (cost !== undefined) {
    recordBudgetSpend(cost);
  }
}
