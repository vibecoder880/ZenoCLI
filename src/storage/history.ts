import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ensureAppDataDirectory } from "./paths.js";

export interface HistoryEntry {
  id: string;
  createdAt: number;
  cwd: string;
  provider: string;
  model: string;
  prompt: string;
  response: string;
  totalTokens: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
}

interface HistoryStore {
  entries: HistoryEntry[];
}

const DEFAULT_HISTORY: HistoryStore = {
  entries: []
};

function getHistoryPath(): string {
  return path.join(ensureAppDataDirectory(), "history.json");
}

function loadHistoryStore(): HistoryStore {
  const historyPath = getHistoryPath();

  if (!existsSync(historyPath)) {
    writeFileSync(historyPath, JSON.stringify(DEFAULT_HISTORY, null, 2), "utf8");
    return DEFAULT_HISTORY;
  }

  return JSON.parse(readFileSync(historyPath, "utf8")) as HistoryStore;
}

function saveHistoryStore(store: HistoryStore): void {
  writeFileSync(getHistoryPath(), JSON.stringify(store, null, 2), "utf8");
}

export function appendHistoryEntry(entry: Omit<HistoryEntry, "id" | "createdAt">): HistoryEntry {
  const store = loadHistoryStore();
  const savedEntry: HistoryEntry = {
    ...entry,
    id: `history-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: Date.now()
  };

  store.entries.unshift(savedEntry);
  store.entries = store.entries.slice(0, 200);
  saveHistoryStore(store);
  return savedEntry;
}

/** Record the estimated cost of a request into the budget tracker. */
export function recordBudgetSpend(costUsd: number, when = new Date()): void {
  // Budget entries persist under ~/.zenocli/budget.json, independent of history
  // so budget tracking survives history truncation.
  const storePath = getBudgetStorePath();
  let entries: Array<{ ts: string; costUsd: number }> = [];
  try {
    const parsed = JSON.parse(readFileSync(storePath, "utf8")) as { entries?: Array<{ ts: string; costUsd: number }> };
    entries = Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    entries = [];
  }
  entries.push({ ts: when.toISOString(), costUsd });
  writeFileSync(storePath, JSON.stringify({ entries }, null, 2), "utf8");
}

function getBudgetStorePath(): string {
  return path.join(ensureAppDataDirectory(), "budget.json");
}

export function listHistoryEntries(limit = 20): HistoryEntry[] {
  return loadHistoryStore().entries.slice(0, limit);
}

export function getHistoryEntry(entryId: string): HistoryEntry | undefined {
  return loadHistoryStore().entries.find((entry) => entry.id === entryId);
}

export function clearHistory(): number {
  const store = loadHistoryStore();
  const count = store.entries.length;
  saveHistoryStore({ entries: [] });
  return count;
}

export function summarizeTokenUsage(): {
  totalEntries: number;
  totalTokens: number;
  totalEstimatedCostUsd: number;
} {
  const entries = loadHistoryStore().entries;

  return {
    totalEntries: entries.length,
    totalTokens: entries.reduce((sum, entry) => sum + entry.totalTokens, 0),
    totalEstimatedCostUsd: Number(
      entries.reduce((sum, entry) => sum + (entry.estimatedCostUsd ?? 0), 0).toFixed(6)
    )
  };
}
