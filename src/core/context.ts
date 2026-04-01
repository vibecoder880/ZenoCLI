import { existsSync, readFileSync } from "node:fs";
import { getProjectInstructionsPath } from "../storage/paths.js";

export function loadProjectInstructions(cwd = process.cwd()): string | undefined {
  const instructionsPath = getProjectInstructionsPath(cwd);

  if (!existsSync(instructionsPath)) {
    return undefined;
  }

  return readFileSync(instructionsPath, "utf8").trim() || undefined;
}
