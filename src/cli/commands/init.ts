import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getProjectInstructionsPath } from "../../storage/paths.js";

const DEFAULT_ENV_EXAMPLE = `# ZenoCLI environment example

OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=

# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:9876/callback

# OpenAI OAuth
OPENAI_OAUTH_AUTH_URL=
OPENAI_OAUTH_TOKEN_URL=
OPENAI_OAUTH_CLIENT_ID=
OPENAI_OAUTH_CLIENT_SECRET=
OPENAI_OAUTH_REDIRECT_URI=http://127.0.0.1:9876/callback
`;

const DEFAULT_ZENO_MD = `# ZENO.md

Project-specific instructions for ZenoCLI.

- Describe architecture and boundaries
- Point at the highest-priority directories
- List validation commands to run before changes are done
`;

export function runInitCommand(cwd: string): void {
  mkdirSync(cwd, { recursive: true });

  const zenoPath = getProjectInstructionsPath(cwd);
  const envExamplePath = path.join(cwd, ".env.example");
  const created: string[] = [];

  if (!existsSync(zenoPath)) {
    writeFileSync(zenoPath, DEFAULT_ZENO_MD, "utf8");
    created.push(zenoPath);
  }

  if (!existsSync(envExamplePath)) {
    writeFileSync(envExamplePath, DEFAULT_ENV_EXAMPLE, "utf8");
    created.push(envExamplePath);
  }

  if (created.length === 0) {
    console.log(`Workspace already initialized at ${cwd}`);
  } else {
    console.log(`Initialized ZenoCLI workspace at ${cwd}`);
    for (const target of created) {
      console.log(`Created ${target}`);
    }
  }

  console.log("Next steps:");
  console.log("  1. Fill in .env.example or save credentials with `zeno auth login`");
  console.log("  2. Edit ZENO.md with project-specific guidance");
  console.log("  3. Run `zeno doctor` to verify readiness");
}
