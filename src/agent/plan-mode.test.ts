import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { PlanManager, createPlan, listPlans, type PlanStep } from "./plan-mode.js";

const testDir = path.join(os.tmpdir(), `.neuro-test-plans-${Date.now()}`);
const testProject = path.join(testDir, "project");

beforeEach(() => {
  mkdirSync(testProject, { recursive: true });
});

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

describe("PlanManager", () => {
  it("creates a plan", () => {
    const steps: PlanStep[] = [
      { step: 1, title: "Setup", description: "Initialize project" },
      { step: 2, title: "Implement", description: "Write the code" },
    ];

    const plan = new PlanManager("plan-1", testProject);
    const created = plan.create("Implement X", "Add feature X to the codebase", steps);

    expect(created.id).toBe("plan-1");
    expect(created.title).toBe("Implement X");
    expect(created.steps).toHaveLength(2);
    expect(created.status).toBe("draft");
    expect(existsSync(plan.filePath)).toBe(true);
  });

  it("loads a plan from disk", () => {
    const steps: PlanStep[] = [{ step: 1, title: "Step 1", description: "Do thing" }];

    const plan = new PlanManager("plan-1", testProject);
    plan.create("Title", "Description", steps);

    const loaded = plan.load();
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe("plan-1");
    expect(loaded?.title).toBe("Title");
    expect(loaded?.steps).toHaveLength(1);
  });

  it("returns null for missing plan", () => {
    const plan = new PlanManager("nonexistent", testProject);
    expect(plan.load()).toBeNull();
  });

  it("approves a plan", () => {
    const steps: PlanStep[] = [{ step: 1, title: "Step", description: "Desc" }];
    const plan = new PlanManager("plan-1", testProject);
    plan.create("Title", "Desc", steps);

    const approved = plan.approve();
    expect(approved?.status).toBe("approved");
  });

  it("rejects with feedback", () => {
    const steps: PlanStep[] = [{ step: 1, title: "Step", description: "Desc" }];
    const plan = new PlanManager("plan-1", testProject);
    plan.create("Title", "Desc", steps);

    const rejected = plan.reject("Need more details");
    expect(rejected?.status).toBe("rejected");
    expect(rejected?.feedback).toBe("Need more details");
  });

  it("marks plan as executed", () => {
    const steps: PlanStep[] = [{ step: 1, title: "Step", description: "Desc" }];
    const plan = new PlanManager("plan-1", testProject);
    plan.create("Title", "Desc", steps);
    plan.approve();

    const executed = plan.markExecuted();
    expect(executed?.status).toBe("executed");
  });

  it("preserves step tools in markdown", () => {
    const steps: PlanStep[] = [
      { step: 1, title: "Read files", description: "Read existing code", tools: ["read_file", "glob"] },
    ];

    const plan = new PlanManager("plan-1", testProject);
    plan.create("Title", "Desc", steps);

    // Reload to verify roundtrip
    plan.load();
    const loaded = new PlanManager("plan-1", testProject).load();
    expect(loaded?.steps[0].tools).toEqual(["read_file", "glob"]);
  });
});

describe("createPlan", () => {
  it("creates a new plan and returns its manager", () => {
    const steps: PlanStep[] = [{ step: 1, title: "Test", description: "Test" }];
    const { id, manager } = createPlan("Title", "Desc", steps, testProject);

    expect(id).toMatch(/^plan_/);
    expect(manager.load()).not.toBeNull();
  });
});

describe("listPlans", () => {
  it("returns empty when no plans", () => {
    expect(listPlans(testProject)).toEqual([]);
  });

  it("lists all plans in directory", () => {
    createPlan("A", "Desc A", [{ step: 1, title: "Step", description: "D" }], testProject);
    createPlan("B", "Desc B", [{ step: 1, title: "Step", description: "D" }], testProject);

    const plans = listPlans(testProject);
    expect(plans).toHaveLength(2);
  });
});
