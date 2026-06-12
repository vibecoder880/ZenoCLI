/**
 * Team Manager — quản lý team lifecycle và coordination.
 *
 * Team: ~/.neurocli/teams/{name}/
 *   ├── config.json      # Team config
 *   ├── tasks.jsonl      # Task list
 *   └── messages/        # Mailboxes
 *       ├── lead.jsonl
 *       ├── researcher.jsonl
 *       └── ...
 */

import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { getTeamDirectory } from "../storage/paths.js";

// ---- Types ----

export interface TeammateConfig {
  name: string;
  agentType: string;
  model?: string;
  /** Optional description of role. */
  role?: string;
}

export interface TeamConfig {
  name: string;
  description: string;
  members: TeammateConfig[];
  createdAt: string;
  updatedAt: string;
}

// ---- Team Manager ----

export class TeamManager {
  private readonly configPath: string;

  constructor(public readonly teamName: string) {
    this.configPath = path.join(getTeamDirectory(teamName), "config.json");
  }

  /** Tạo team mới. */
  create(description: string, members: TeammateConfig[]): TeamConfig {
    const config: TeamConfig = {
      name: this.teamName,
      description,
      members,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    writeFileSync(this.configPath, JSON.stringify(config, null, 2), "utf8");
    return config;
  }

  /** Load team config. */
  load(): TeamConfig | null {
    if (!existsSync(this.configPath)) return null;
    try {
      return JSON.parse(readFileSync(this.configPath, "utf8")) as TeamConfig;
    } catch {
      return null;
    }
  }

  /** Thêm member vào team. */
  addMember(member: TeammateConfig): TeamConfig {
    const config = this.load();
    if (!config) throw new Error(`Team ${this.teamName} does not exist`);

    if (!config.members.some((m) => m.name === member.name)) {
      config.members.push(member);
      config.updatedAt = new Date().toISOString();
      writeFileSync(this.configPath, JSON.stringify(config, null, 2), "utf8");
    }

    return config;
  }

  /** Xóa member. */
  removeMember(name: string): TeamConfig {
    const config = this.load();
    if (!config) throw new Error(`Team ${this.teamName} does not exist`);

    config.members = config.members.filter((m) => m.name !== name);
    config.updatedAt = new Date().toISOString();
    writeFileSync(this.configPath, JSON.stringify(config, null, 2), "utf8");
    return config;
  }

  /** Update team config. */
  update(updates: Partial<Omit<TeamConfig, "name" | "createdAt">>): TeamConfig {
    const config = this.load();
    if (!config) throw new Error(`Team ${this.teamName} does not exist`);

    const updated: TeamConfig = {
      ...config,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    writeFileSync(this.configPath, JSON.stringify(updated, null, 2), "utf8");
    return updated;
  }

  /** Xóa team. */
  delete(): void {
    if (existsSync(this.configPath)) {
      writeFileSync(this.configPath, "", "utf8");
    }
  }

  /** Check team tồn tại. */
  exists(): boolean {
    return existsSync(this.configPath) && this.load() !== null;
  }

  /** Get member names. */
  getMemberNames(): string[] {
    const config = this.load();
    return config?.members.map((m) => m.name) ?? [];
  }
}

// ---- Helpers ----

/** List tất cả teams. */
export function listTeams(): TeamConfig[] {
  const teamsDir = path.join(getAppDataDirectory(), "teams");
  if (!existsSync(teamsDir)) return [];

  const dirs = readdirSync(teamsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const teams: TeamConfig[] = [];
  for (const name of dirs) {
    const mgr = new TeamManager(name);
    const config = mgr.load();
    if (config) teams.push(config);
  }

  return teams;
}

function getAppDataDirectory(): string {
  return path.join(os.homedir(), ".neurocli");
}
