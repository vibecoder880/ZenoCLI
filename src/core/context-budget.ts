/**
 * Context Budget — per-turn token budget management.
 *
 * Allocates token budget across:
 *   - System prompt (fixed)
 *   - Conversation context (variable)
 *   - Output (variable)
 *
 * Budget-aware tool selection: skip heavy tools khi budget thấp.
 */

const HEAVY_TOOLS = new Set([
  "web_search",
  "web_fetch",
]);

// ---- Types ----

export interface BudgetAllocation {
  system: number;
  context: number;
  output: number;
  tools: number;
}

export interface BudgetStatus {
  total: number;
  used: number;
  remaining: number;
  utilization: number;
  allocation: BudgetAllocation;
}

// ---- Context Budget ----

export class ContextBudget {
  private systemUsed = 0;
  private contextUsed = 0;
  private outputUsed = 0;
  private toolsUsed = 0;
  private readonly total: number;

  constructor(totalBudget: number) {
    this.total = totalBudget;
  }

  /** Set allocation (percentages). */
  allocate(percentages?: Partial<BudgetAllocation>): BudgetAllocation {
    const allocation: BudgetAllocation = {
      system: percentages?.system ?? 0.20,   // 20%
      context: percentages?.context ?? 0.55,  // 55%
      output: percentages?.output ?? 0.20,   // 20%
      tools: percentages?.tools ?? 0.05,     // 5%
    };
    return allocation;
  }

  /** Track system tokens used. */
  useSystem(tokens: number): void {
    this.systemUsed = tokens;
  }

  /** Track context tokens used. */
  useContext(tokens: number): void {
    this.contextUsed = tokens;
  }

  /** Track output tokens used. */
  useOutput(tokens: number): void {
    this.outputUsed = tokens;
  }

  /** Track tool result tokens. */
  useTools(tokens: number): void {
    this.toolsUsed = tokens;
  }

  /** Get current status. */
  getStatus(): BudgetStatus {
    const used = this.systemUsed + this.contextUsed + this.outputUsed + this.toolsUsed;
    return {
      total: this.total,
      used,
      remaining: Math.max(0, this.total - used),
      utilization: used / this.total,
      allocation: {
        system: this.systemUsed,
        context: this.contextUsed,
        output: this.outputUsed,
        tools: this.toolsUsed,
      },
    };
  }

  /** Check if a tool should be skipped due to low budget. */
  shouldSkipHeavyTool(): boolean {
    const status = getStatusSafe(this);
    return status.utilization > 0.8;
  }

  /** Filter tools based on budget. */
  filterTools<T extends { name: string }>(tools: T[]): T[] {
    if (this.shouldSkipHeavyTool()) {
      return tools.filter((t) => !HEAVY_TOOLS.has(t.name));
    }
    return tools;
  }

  /** Reset budget for a new turn. */
  reset(): void {
    this.systemUsed = 0;
    this.contextUsed = 0;
    this.outputUsed = 0;
    this.toolsUsed = 0;
  }
}

function getStatusSafe(budget: ContextBudget): BudgetStatus {
  return budget.getStatus();
}
