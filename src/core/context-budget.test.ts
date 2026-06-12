import { describe, expect, it } from "vitest";
import { ContextBudget } from "./context-budget.js";

describe("ContextBudget", () => {
  it("tracks system tokens", () => {
    const budget = new ContextBudget(1000);
    budget.useSystem(200);
    const status = budget.getStatus();
    expect(status.allocation.system).toBe(200);
    expect(status.used).toBe(200);
  });

  it("tracks context tokens", () => {
    const budget = new ContextBudget(1000);
    budget.useContext(500);
    const status = budget.getStatus();
    expect(status.allocation.context).toBe(500);
  });

  it("tracks output tokens", () => {
    const budget = new ContextBudget(1000);
    budget.useOutput(300);
    const status = budget.getStatus();
    expect(status.allocation.output).toBe(300);
  });

  it("tracks tool tokens", () => {
    const budget = new ContextBudget(1000);
    budget.useTools(50);
    const status = budget.getStatus();
    expect(status.allocation.tools).toBe(50);
  });

  it("calculates utilization", () => {
    const budget = new ContextBudget(1000);
    budget.useSystem(200);
    budget.useContext(500);
    budget.useOutput(200);
    budget.useTools(50);

    const status = budget.getStatus();
    expect(status.utilization).toBe(0.95);
    expect(status.remaining).toBe(50);
  });

  it("clamps remaining to 0", () => {
    const budget = new ContextBudget(100);
    budget.useContext(200);
    const status = budget.getStatus();
    expect(status.remaining).toBe(0);
  });

  it("resets budget", () => {
    const budget = new ContextBudget(1000);
    budget.useSystem(500);
    budget.reset();

    const status = budget.getStatus();
    expect(status.used).toBe(0);
  });

  it("allocates default percentages", () => {
    const budget = new ContextBudget(1000);
    const allocation = budget.allocate();
    expect(allocation.system).toBeCloseTo(0.20);
    expect(allocation.context).toBeCloseTo(0.55);
    expect(allocation.output).toBeCloseTo(0.20);
    expect(allocation.tools).toBeCloseTo(0.05);
  });

  it("supports custom allocation", () => {
    const budget = new ContextBudget(1000);
    const allocation = budget.allocate({ context: 0.7, output: 0.1 });
    expect(allocation.context).toBe(0.7);
    expect(allocation.output).toBe(0.1);
  });

  it("skips heavy tools when budget is low", () => {
    const budget = new ContextBudget(1000);
    budget.useContext(900); // 90% utilization

    expect(budget.shouldSkipHeavyTool()).toBe(true);

    const tools = [
      { name: "read_file" },
      { name: "web_search" },
      { name: "web_fetch" },
    ];
    const filtered = budget.filterTools(tools);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("read_file");
  });

  it("allows heavy tools when budget is healthy", () => {
    const budget = new ContextBudget(1000);
    budget.useContext(200); // 20% utilization

    expect(budget.shouldSkipHeavyTool()).toBe(false);

    const tools = [
      { name: "read_file" },
      { name: "web_search" },
    ];
    expect(budget.filterTools(tools)).toHaveLength(2);
  });
});
