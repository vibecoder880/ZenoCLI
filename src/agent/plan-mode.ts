/**
 * Plan Mode — agent đề xuất implementation plan, user review và approve.
 *
 * Plans stored trong .zeno/plans/ as markdown.
 * Workflow:
 *   1. Agent analyzes request
 *   2. Proposes structured plan
 *   3. User reviews (approve / modify / reject)
 *   4. If approved, plan can be executed
 */

import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getProjectPlansDirectory } from "../storage/paths.js";

// ---- Types ----

export type PlanStatus = "draft" | "approved" | "rejected" | "executed";

export interface PlanStep {
  /** Step number. */
  step: number;
  /** Short title. */
  title: string;
  /** Description of what to do. */
  description: string;
  /** Tools this step will use. */
  tools?: string[];
  /** Whether this step is completed. */
  completed?: boolean;
}

export interface Plan {
  id: string;
  title: string;
  description: string;
  steps: PlanStep[];
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
  /** User feedback if rejected. */
  feedback?: string;
}

// ---- Helpers ----

function generatePlanId(): string {
  return `plan_${crypto.randomBytes(4).toString("hex")}`;
}

// ---- Plan Management ----

export class PlanManager {
  private readonly planPath: string;

  constructor(
    readonly planId: string,
    cwd: string = process.cwd(),
  ) {
    this.planPath = path.join(getProjectPlansDirectory(cwd), `${planId}.md`);
  }

  /** Tạo plan mới. */
  create(title: string, description: string, steps: PlanStep[]): Plan {
    const plan: Plan = {
      id: this.planId,
      title,
      description,
      steps,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.writePlan(plan);
    return plan;
  }

  /** Load plan. */
  load(): Plan | null {
    if (!existsSync(this.planPath)) return null;
    const content = readFileSync(this.planPath, "utf8");
    return this.parseMarkdown(content);
  }

  /** Update plan status. */
  setStatus(status: PlanStatus, feedback?: string): Plan | null {
    const plan = this.load();
    if (!plan) return null;

    plan.status = status;
    plan.updatedAt = new Date().toISOString();
    if (feedback) plan.feedback = feedback;

    this.writePlan(plan);
    return plan;
  }

  /** Approve plan. */
  approve(): Plan | null {
    return this.setStatus("approved");
  }

  /** Reject plan. */
  reject(feedback: string): Plan | null {
    return this.setStatus("rejected", feedback);
  }

  /** Mark plan as executed. */
  markExecuted(): Plan | null {
    return this.setStatus("executed");
  }

  /** Get plan path. */
  get filePath(): string {
    return this.planPath;
  }

  // ---- Private ----

  private writePlan(plan: Plan): void {
    const md = this.toMarkdown(plan);
    writeFileSync(this.planPath, md, "utf8");
  }

  private toMarkdown(plan: Plan): string {
    const lines: string[] = [
      "---",
      `id: ${plan.id}`,
      `title: ${plan.title}`,
      `status: ${plan.status}`,
      `createdAt: ${plan.createdAt}`,
      `updatedAt: ${plan.updatedAt}`,
    ];

    if (plan.feedback) {
      lines.push(`feedback: ${plan.feedback.replace(/\n/g, " ")}`);
    }

    lines.push("---", "", `# ${plan.title}`, "", plan.description, "", "## Steps", "");

    for (const step of plan.steps) {
      lines.push(`### Step ${step.step}: ${step.title}`);
      lines.push("");
      lines.push(step.description);
      if (step.tools && step.tools.length > 0) {
        lines.push("");
        lines.push(`**Tools:** ${step.tools.join(", ")}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  private parseMarkdown(content: string): Plan | null {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return null;

    const frontmatter: Record<string, string> = {};
    for (const line of match[1].split("\n")) {
      const kv = line.match(/^(\w+)\s*:\s*(.+)$/);
      if (kv) frontmatter[kv[1]] = kv[2];
    }

    if (!frontmatter.id) return null;

    // Parse steps from body
    const body = match[2];
    const stepMatches = body.matchAll(/### Step (\d+): (.+)\n\n([\s\S]*?)(?=\n### Step|\n## |\n*$)/g);
    const steps: PlanStep[] = [];

    for (const stepMatch of stepMatches) {
      const description = stepMatch[3].trim();
      const toolsMatch = description.match(/\*\*Tools:\*\*\s*(.+)/);
      const step: PlanStep = {
        step: Number(stepMatch[1]),
        title: stepMatch[2].trim(),
        description: description.replace(/\*\*Tools:\*\*\s*.+/, "").trim(),
        tools: toolsMatch ? toolsMatch[1].split(",").map((t) => t.trim()) : undefined,
      };
      steps.push(step);
    }

    // Extract title
    const titleMatch = body.match(/^# (.+)/m);
    const title = titleMatch?.[1]?.trim() ?? frontmatter.title ?? "Untitled";

    // Extract description (paragraph after title)
    const descMatch = body.match(/^# .+\n\n([\s\S]*?)\n\n## Steps/);
    const description = descMatch?.[1]?.trim() ?? "";

    return {
      id: frontmatter.id,
      title,
      description,
      steps,
      status: (frontmatter.status as PlanStatus) ?? "draft",
      createdAt: frontmatter.createdAt ?? new Date().toISOString(),
      updatedAt: frontmatter.updatedAt ?? new Date().toISOString(),
      feedback: frontmatter.feedback,
    };
  }
}

// ---- List plans ----

/** List tất cả plans trong project. */
export function listPlans(cwd: string = process.cwd()): Plan[] {
  const plansDir = getProjectPlansDirectory(cwd);
  if (!existsSync(plansDir)) return [];

  const files = readdirSync(plansDir).filter((f) => f.endsWith(".md"));
  const plans: Plan[] = [];

  for (const file of files) {
    const planId = file.replace(/\.md$/, "");
    const mgr = new PlanManager(planId, cwd);
    const plan = mgr.load();
    if (plan) plans.push(plan);
  }

  return plans;
}

/** Tạo plan mới và trả về PlanManager để quản lý. */
export function createPlan(
  title: string,
  description: string,
  steps: PlanStep[],
  cwd: string = process.cwd(),
): { id: string; manager: PlanManager } {
  const id = generatePlanId();
  const manager = new PlanManager(id, cwd);
  manager.create(title, description, steps);
  return { id, manager };
}
