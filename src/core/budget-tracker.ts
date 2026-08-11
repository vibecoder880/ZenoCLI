/**
 * Budget Tracker — ported pattern from Super Kit's `CostTracker`.
 *
 * Tracks model spend with optional daily/monthly USD limits, fires an alert
 * once spend crosses a threshold fraction of the budget, and can signal the
 * router to downgrade its strategy (auto downgrade) so ZenoCLI stays within
 * budget. State is stored alongside the history file under ~/.zenocli.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ensureAppDataDirectory } from "../storage/paths.js";

export interface BudgetConfig {
  /** Daily spend limit in USD (0 = unlimited). */
  dailyLimitUsd: number;
  /** Monthly spend limit in USD (0 = unlimited). */
  monthlyLimitUsd: number;
  /** Alert threshold as a fraction of the budget (0-1). Default 0.8. */
  alertThreshold: number;
  /** Downgrade routing strategy to cost when budget is nearly used. */
  autoDowngrade: boolean;
}

export interface BudgetStatus {
  todaySpendUsd: number;
  monthSpendUsd: number;
  dailyRemainingUsd: number;
  monthlyRemainingUsd: number;
  dailyPercent: number;
  monthlyPercent: number;
  overDaily: boolean;
  overMonthly: boolean;
  alert: boolean;
  /** When true, the router should prefer cheap models this period. */
  shouldDowngrade: boolean;
}

interface BudgetEntry {
  /** ISO timestamp. */
  ts: string;
  /** Cost in USD. */
  costUsd: number;
}

const DEFAULT_CONFIG: BudgetConfig = {
  dailyLimitUsd: 0,
  monthlyLimitUsd: 0,
  alertThreshold: 0.8,
  autoDowngrade: true,
};

function getStorePath(): string {
  return path.join(ensureAppDataDirectory(), "budget.json");
}

/** Load persisted spend entries, tolerant of a missing/corrupt file. */
function loadEntries(): BudgetEntry[] {
  const storePath = getStorePath();
  if (!existsSync(storePath)) {
    return [];
  }
  try {
    const parsed = JSON.parse(readFileSync(storePath, "utf8")) as { entries?: BudgetEntry[] };
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
}

function startOfDay(now: Date): number {
  const copy = new Date(now);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

function startOfMonth(now: Date): number {
  const copy = new Date(now);
  copy.setDate(1);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

export class BudgetTracker {
  constructor(private readonly config: Partial<BudgetConfig> = {}) {}

  private getConfig(): BudgetConfig {
    return { ...DEFAULT_CONFIG, ...this.config };
  }

  /** Spend + budget status for the current day/month. */
  getStatus(now = new Date()): BudgetStatus {
    const config = this.getConfig();
    const entries = loadEntries();
    const dayStart = startOfDay(now);
    const monthStart = startOfMonth(now);

    let todaySpendUsd = 0;
    let monthSpendUsd = 0;
    for (const entry of entries) {
      const ts = new Date(entry.ts).getTime();
      if (ts >= dayStart) todaySpendUsd += entry.costUsd;
      if (ts >= monthStart) monthSpendUsd += entry.costUsd;
    }

    const dailyLimit = config.dailyLimitUsd;
    const monthlyLimit = config.monthlyLimitUsd;
    const dailyPercent = dailyLimit > 0 ? (todaySpendUsd / dailyLimit) * 100 : 0;
    const monthlyPercent = monthlyLimit > 0 ? (monthSpendUsd / monthlyLimit) * 100 : 0;
    const overDaily = dailyLimit > 0 && todaySpendUsd >= dailyLimit;
    const overMonthly = monthlyLimit > 0 && monthSpendUsd >= monthlyLimit;
    const alert =
      (dailyLimit > 0 && dailyPercent >= config.alertThreshold * 100) ||
      (monthlyLimit > 0 && monthlyPercent >= config.alertThreshold * 100);
    const shouldDowngrade =
      config.autoDowngrade && (overDaily || overMonthly || (dailyLimit > 0 && dailyPercent >= 90) || (monthlyLimit > 0 && monthlyPercent >= 90));

    return {
      todaySpendUsd,
      monthSpendUsd,
      dailyRemainingUsd: dailyLimit > 0 ? Math.max(0, dailyLimit - todaySpendUsd) : Infinity,
      monthlyRemainingUsd: monthlyLimit > 0 ? Math.max(0, monthlyLimit - monthSpendUsd) : Infinity,
      dailyPercent,
      monthlyPercent,
      overDaily,
      overMonthly,
      alert,
      shouldDowngrade,
    };
  }
}
