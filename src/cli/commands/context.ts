import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getProjectInstructionsPath } from "../../storage/paths.js";

const DEFAULT_CONTEXT = `# ZENO.md

Project-specific instructions for ZenoCLI.

- Describe coding standards
- Call out folders to prioritize
- Explain local commands or validation rules
`;

export function runContextShowCommand(cwd: string): void {
  const targetPath = getProjectInstructionsPath(cwd);

  if (!existsSync(targetPath)) {
    console.log(`No ZENO.md found at ${targetPath}`);
    return;
  }

  console.log(readFileSync(targetPath, "utf8"));
}

export function runContextInitCommand(cwd: string): void {
  const targetPath = getProjectInstructionsPath(cwd);

  if (!existsSync(targetPath)) {
    mkdirSync(path.dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, DEFAULT_CONTEXT, "utf8");
    console.log(`Created ${targetPath}`);
    return;
  }

  console.log(`ZENO.md already exists at ${targetPath}`);
}

export function runContextSetCommand(cwd: string, content: string): void {
  const targetPath = getProjectInstructionsPath(cwd);
  mkdirSync(path.dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, content, "utf8");
  console.log(`Updated ${targetPath}`);
}
