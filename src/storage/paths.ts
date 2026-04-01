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
