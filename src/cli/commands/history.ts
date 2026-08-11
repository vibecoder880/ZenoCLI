import { clearHistory, getHistoryEntry, listHistoryEntries, summarizeTokenUsage } from "../../storage/history.js";
import { BudgetTracker } from "../../core/budget-tracker.js";
import { loadConfig } from "../../storage/config.js";

export function runHistoryListCommand(limit = 10): void {
  const entries = listHistoryEntries(limit);

  if (entries.length === 0) {
    console.log("No session history recorded.");
    return;
  }

  for (const entry of entries) {
    console.log(
      `[${new Date(entry.createdAt).toISOString()}] ${entry.provider}/${entry.model} tokens=${entry.totalTokens} cost=$${(entry.estimatedCostUsd ?? 0).toFixed(6)}`
    );
    console.log(`prompt: ${entry.prompt}`);
    console.log(`response: ${entry.response.slice(0, 160)}`);
    console.log("");
  }
}

export function runHistoryShowCommand(entryId: string): void {
  const entry = getHistoryEntry(entryId);

  if (!entry) {
    console.log(`History entry ${entryId} was not found.`);
    return;
  }

  console.log(`id: ${entry.id}`);
  console.log(`createdAt: ${new Date(entry.createdAt).toISOString()}`);
  console.log(`cwd: ${entry.cwd}`);
  console.log(`provider: ${entry.provider}`);
  console.log(`model: ${entry.model}`);
  console.log(`totalTokens: ${entry.totalTokens}`);
  console.log(`estimatedCostUsd: ${(entry.estimatedCostUsd ?? 0).toFixed(6)}`);
  console.log("");
  console.log("prompt:");
  console.log(entry.prompt);
  console.log("");
  console.log("response:");
  console.log(entry.response);
}

export function runHistoryClearCommand(): void {
  const removed = clearHistory();
  console.log(`Removed ${removed} history entries.`);
}

export function runCostCommand(): void {
  const usage = summarizeTokenUsage();
  console.log(`History entries: ${usage.totalEntries}`);
  console.log(`Total tokens tracked: ${usage.totalTokens}`);
  console.log(`Estimated total cost (USD): $${usage.totalEstimatedCostUsd.toFixed(6)}`);

  const budget = new BudgetTracker(loadConfig().budget ?? {}).getStatus();
  const fmt = (value: number): string => (value === Infinity ? "∞" : `$${value.toFixed(2)}`);
  console.log(`Today spend: $${budget.todaySpendUsd.toFixed(2)} (daily left: ${fmt(budget.dailyRemainingUsd)})`);
  console.log(`Month spend: $${budget.monthSpendUsd.toFixed(2)} (monthly left: ${fmt(budget.monthlyRemainingUsd)})`);

  if (budget.overDaily || budget.overMonthly) {
    console.log("⚠ Budget exceeded — router downgrading to cost strategy.");
  } else if (budget.alert) {
    console.log("⚠ Budget alert — approaching configured limit.");
  }
}
