import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { TaskList, ensureTeamDirectory } from "./task-list.js";

const testDir = path.join(os.tmpdir(), `.zeno-test-tasks-${Date.now()}`);

beforeEach(() => {
  process.env.HOME = testDir;
  process.env.USERPROFILE = testDir;
});

afterEach(() => {
  delete process.env.HOME;
  delete process.env.USERPROFILE;
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

describe("TaskList", () => {
  it("starts with no tasks", () => {
    const tl = new TaskList("test-team");
    expect(tl.loadAll()).toEqual([]);
  });

  it("creates a task", () => {
    const tl = new TaskList("test-team");
    const task = tl.create({
      subject: "Implement feature X",
      description: "Add feature X to the codebase",
    });

    expect(task.id).toMatch(/^task_/);
    expect(task.subject).toBe("Implement feature X");
    expect(task.status).toBe("pending");
    expect(tl.loadAll()).toHaveLength(1);
  });

  it("gets task by ID", () => {
    const tl = new TaskList("test-team");
    const created = tl.create({ subject: "Test", description: "Desc" });

    const found = tl.get(created.id);
    expect(found).toBeDefined();
    expect(found?.id).toBe(created.id);
  });

  it("claims a task", () => {
    const tl = new TaskList("test-team");
    const task = tl.create({ subject: "Test", description: "Desc" });

    const claimed = tl.claim(task.id, "researcher-1");
    expect(claimed?.status).toBe("in_progress");
    expect(claimed?.owner).toBe("researcher-1");
  });

  it("completes a task", () => {
    const tl = new TaskList("test-team");
    const task = tl.create({ subject: "Test", description: "Desc" });
    tl.claim(task.id, "researcher-1");

    const completed = tl.complete(task.id);
    expect(completed?.status).toBe("completed");
  });

  it("filters by status", () => {
    const tl = new TaskList("test-team");
    const t1 = tl.create({ subject: "T1", description: "" });
    tl.create({ subject: "T2", description: "" });
    tl.claim(t1.id, "owner-1");

    const inProgress = tl.getByStatus("in_progress");
    expect(inProgress).toHaveLength(1);
    expect(inProgress[0].id).toBe(t1.id);

    const pending = tl.getByStatus("pending");
    expect(pending).toHaveLength(1);
  });

  it("filters by owner", () => {
    const tl = new TaskList("test-team");
    const t1 = tl.create({ subject: "T1", description: "" });
    const t2 = tl.create({ subject: "T2", description: "" });

    tl.claim(t1.id, "alice");
    tl.claim(t2.id, "bob");

    expect(tl.getByOwner("alice")).toHaveLength(1);
    expect(tl.getByOwner("bob")).toHaveLength(1);
  });

  it("respects dependencies (blockedBy)", () => {
    const tl = new TaskList("test-team");
    const dep = tl.create({ subject: "Setup", description: "" });
    const dependent = tl.create({
      subject: "Build on setup",
      description: "",
      blockedBy: [dep.id],
    });

    // Initially, only dep is unblocked
    const unblocked = tl.getUnblocked();
    expect(unblocked).toHaveLength(1);
    expect(unblocked[0].id).toBe(dep.id);

    // Complete dep
    tl.complete(dep.id);

    // Now dependent is unblocked
    const unblocked2 = tl.getUnblocked();
    expect(unblocked2).toHaveLength(1);
    expect(unblocked2[0].id).toBe(dependent.id);
  });

  it("canClaim respects blockedBy", () => {
    const tl = new TaskList("test-team");
    const dep = tl.create({ subject: "Setup", description: "" });
    const dependent = tl.create({
      subject: "Build on setup",
      description: "",
      blockedBy: [dep.id],
    });

    // Can claim dep
    expect(tl.canClaim(dep.id)).toBe(true);
    // Cannot claim dependent yet
    expect(tl.canClaim(dependent.id)).toBe(false);

    // After dep is completed, can claim dependent
    tl.complete(dep.id);
    expect(tl.canClaim(dependent.id)).toBe(true);
  });

  it("soft-deletes tasks", () => {
    const tl = new TaskList("test-team");
    const task = tl.create({ subject: "Test", description: "" });

    expect(tl.loadAll()).toHaveLength(1);
    tl.delete(task.id);
    expect(tl.loadAll()).toHaveLength(0);
  });

  it("supports multiple dependencies", () => {
    const tl = new TaskList("test-team");
    const a = tl.create({ subject: "A", description: "" });
    const b = tl.create({ subject: "B", description: "" });
    const c = tl.create({
      subject: "C",
      description: "",
      blockedBy: [a.id, b.id],
    });

    expect(tl.canClaim(c.id)).toBe(false);
    tl.complete(a.id);
    expect(tl.canClaim(c.id)).toBe(false); // b not done
    tl.complete(b.id);
    expect(tl.canClaim(c.id)).toBe(true);
  });
});

describe("ensureTeamDirectory", () => {
  it("creates team directory", () => {
    const dir = ensureTeamDirectory("my-team");
    expect(existsSync(dir)).toBe(true);
  });
});
