import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { TeamManager, listTeams } from "./team.js";

const testDir = path.join(os.tmpdir(), `.zeno-test-team-${Date.now()}`);

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

describe("TeamManager", () => {
  it("creates a team", () => {
    const mgr = new TeamManager("my-team");
    const config = mgr.create("Test team", [
      { name: "lead", agentType: "coordinator" },
      { name: "researcher", agentType: "researcher" },
    ]);

    expect(config.name).toBe("my-team");
    expect(config.members).toHaveLength(2);
    expect(mgr.exists()).toBe(true);
  });

  it("loads existing team", () => {
    const mgr = new TeamManager("my-team");
    mgr.create("Test team", [{ name: "lead", agentType: "coordinator" }]);

    const mgr2 = new TeamManager("my-team");
    const config = mgr2.load();
    expect(config).not.toBeNull();
    expect(config?.members[0].name).toBe("lead");
  });

  it("returns null for non-existent team", () => {
    const mgr = new TeamManager("nonexistent");
    expect(mgr.load()).toBeNull();
  });

  it("adds a member", () => {
    const mgr = new TeamManager("my-team");
    mgr.create("Test", [{ name: "lead", agentType: "coordinator" }]);

    mgr.addMember({ name: "coder", agentType: "coder" });

    const config = mgr.load();
    expect(config?.members).toHaveLength(2);
    expect(config?.members.some((m) => m.name === "coder")).toBe(true);
  });

  it("does not duplicate existing member", () => {
    const mgr = new TeamManager("my-team");
    mgr.create("Test", [{ name: "lead", agentType: "coordinator" }]);
    mgr.addMember({ name: "lead", agentType: "coordinator" });

    const config = mgr.load();
    expect(config?.members).toHaveLength(1);
  });

  it("removes a member", () => {
    const mgr = new TeamManager("my-team");
    mgr.create("Test", [
      { name: "lead", agentType: "coordinator" },
      { name: "coder", agentType: "coder" },
    ]);

    mgr.removeMember("coder");

    const config = mgr.load();
    expect(config?.members).toHaveLength(1);
    expect(config?.members[0].name).toBe("lead");
  });

  it("updates team config", () => {
    const mgr = new TeamManager("my-team");
    mgr.create("Old description", [{ name: "lead", agentType: "coordinator" }]);

    mgr.update({ description: "New description" });

    const config = mgr.load();
    expect(config?.description).toBe("New description");
  });

  it("gets member names", () => {
    const mgr = new TeamManager("my-team");
    mgr.create("Test", [
      { name: "alice", agentType: "coder" },
      { name: "bob", agentType: "reviewer" },
    ]);

    expect(mgr.getMemberNames()).toEqual(["alice", "bob"]);
  });

  it("checks team exists", () => {
    const mgr = new TeamManager("nonexistent");
    expect(mgr.exists()).toBe(false);
  });
});

describe("listTeams", () => {
  it("returns empty when no teams", () => {
    expect(listTeams()).toEqual([]);
  });

  it("lists all teams", () => {
    new TeamManager("team-a").create("A", [{ name: "lead", agentType: "coordinator" }]);
    new TeamManager("team-b").create("B", [{ name: "lead", agentType: "coordinator" }]);

    const teams = listTeams();
    expect(teams).toHaveLength(2);
  });
});
