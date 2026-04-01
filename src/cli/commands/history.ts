import { listHistoryEntries, summarizeTokenUsage } from "../../storage/history.js";

export function runHistoryCommand(limit = 10): void {
  const entries = listHistoryEntries(limit);

  if (entries.length === 0) {
    console.log("No session history recorded.");
    return;
  }

  for (const entry of entries) {
    console.log(
      `[${new Date(entry.createdAt).toISOString()}] ${entry.provider}/${entry.model} tokens=${entry.totalTokens}`
    );
    console.log(`prompt: ${entry.prompt}`);
    console.log(`response: ${entry.response.slice(0, 160)}`);
    console.log("");
  }
}

export function runCostCommand(): void {
  const usage = summarizeTokenUsage();
  console.log(`History entries: ${usage.totalEntries}`);
  console.log(`Total tokens tracked: ${usage.totalTokens}`);
}
