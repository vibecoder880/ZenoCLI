import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { getProjectInstructionsPath } from "../../storage/paths.js";

const DEFAULT_CONTEXT = `# NEURO.md

Project-specific instructions for NeuroCLI.

- Describe coding standards
- Call out folders to prioritize
- Explain local commands or validation rules
`;

export function runContextShowCommand(cwd: string): void {
  const targetPath = getProjectInstructionsPath(cwd);

  if (!existsSync(targetPath)) {
    console.log(`No NEURO.md found at ${targetPath}`);
    return;
  }

  console.log(readFileSync(targetPath, "utf8"));
}

export function runContextInitCommand(cwd: string): void {
  const targetPath = getProjectInstructionsPath(cwd);

  if (!existsSync(targetPath)) {
    writeFileSync(targetPath, DEFAULT_CONTEXT, "utf8");
    console.log(`Created ${targetPath}`);
    return;
  }

  console.log(`NEURO.md already exists at ${targetPath}`);
}

export function runContextSetCommand(cwd: string, content: string): void {
  const targetPath = getProjectInstructionsPath(cwd);
  writeFileSync(targetPath, content, "utf8");
  console.log(`Updated ${targetPath}`);
}
