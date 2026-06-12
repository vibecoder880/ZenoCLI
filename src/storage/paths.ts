import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { mkdirSync } from "node:fs";

export function getAppDataDirectory(): string {
  return path.join(os.homedir(), ".neurocli");
}

export function ensureAppDataDirectory(): string {
  const directory = getAppDataDirectory();
  mkdirSync(directory, { recursive: true });
  return directory;
}

export function getProjectInstructionsPath(cwd = process.cwd()): string {
  return path.join(cwd, "NEURO.md");
}

export function getHistoryPathname(): string {
  return path.join(ensureAppDataDirectory(), "history.json");
}

export function getAuthProfilesPathname(): string {
  return path.join(ensureAppDataDirectory(), "auth-profiles.json");
}

/** Hash a directory path to a short stable slug for project-scoped storage. */
export function projectHash(cwd: string): string {
  return crypto.createHash("sha256").update(cwd).digest("hex").slice(0, 16);
}

// --- Session paths ---

export function getSessionsDirectory(cwd = process.cwd()): string {
  const dir = path.join(getAppDataDirectory(), "projects", projectHash(cwd), "sessions");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function getSessionPath(sessionId: string, cwd = process.cwd()): string {
  return path.join(getSessionsDirectory(cwd), `${sessionId}.jsonl`);
}

// --- Memory paths ---

export function getMemoryDirectory(cwd = process.cwd()): string {
  const dir = path.join(getAppDataDirectory(), "projects", projectHash(cwd));
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function getMemoryPath(cwd = process.cwd()): string {
  return path.join(getMemoryDirectory(cwd), "MEMORY.md");
}

export function getGlobalMemoryPath(): string {
  return path.join(getAppDataDirectory(), "MEMORY.md");
}

// --- Rules paths ---

export function getProjectRulesDirectory(cwd = process.cwd()): string {
  return path.join(cwd, ".neuro", "rules");
}

// --- Phase 2 paths ---

/** Global skills directory: ~/.neurocli/skills/ */
export function getGlobalSkillsDirectory(): string {
  const dir = path.join(getAppDataDirectory(), "skills");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Project skills directory: .neuro/skills/ */
export function getProjectSkillsDirectory(cwd = process.cwd()): string {
  return path.join(cwd, ".neuro", "skills");
}

/** Built-in skills directory: bundled with the CLI */
export function getBuiltinSkillsDirectory(): string {
  return path.join(getAppDataDirectory(), "builtin-skills");
}

// --- Phase 3 paths ---

/** Directory for a team: ~/.neurocli/teams/{name}/ */
export function getTeamDirectory(teamName: string): string {
  const dir = path.join(getAppDataDirectory(), "teams", teamName);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Task list file for a team: ~/.neurocli/teams/{name}/tasks.jsonl */
export function getTaskListPath(teamName: string): string {
  return path.join(getTeamDirectory(teamName), "tasks.jsonl");
}

/** Mailbox file for a teammate: ~/.neurocli/teams/{name}/messages/{teammate}.jsonl */
export function getMailboxPath(teamName: string, teammate: string): string {
  const dir = path.join(getTeamDirectory(teamName), "messages");
  mkdirSync(dir, { recursive: true });
  return path.join(dir, `${teammate}.jsonl`);
}

/** Project plans directory: .neuro/plans/ */
export function getProjectPlansDirectory(cwd = process.cwd()): string {
  const dir = path.join(cwd, ".neuro", "plans");
  mkdirSync(dir, { recursive: true });
  return dir;
}
