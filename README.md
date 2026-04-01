# NeuroCLI

NeuroCLI is a terminal coding assistant focused on a clean CLI, multiple model providers, local auth profile storage, and a pragmatic path to agentic workflows.

## Current scope

- Interactive TUI with Ink
- One-shot chat command
- Local tool-using agent loop
- Provider routing with model aliases
- Local auth profile store for OpenAI, Anthropic, and Google API keys
- Release packaging for Windows and Linux through GitHub Actions

## Requirements

- Node.js 22+
- One of these credentials:
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `GOOGLE_API_KEY`

You can also save credentials locally:

```bash
neuro auth login openai --method api-key
neuro auth login anthropic --method api-key
neuro auth login google --method api-key
neuro auth status
neuro auth refresh google
```

OAuth login is also supported:

```bash
neuro auth login google --method oauth
neuro auth login openai --method oauth --manual-code
```

OAuth environment variables:

```bash
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:9876/callback

OPENAI_OAUTH_AUTH_URL=...
OPENAI_OAUTH_TOKEN_URL=...
OPENAI_OAUTH_CLIENT_ID=...
OPENAI_OAUTH_CLIENT_SECRET=...
OPENAI_OAUTH_REDIRECT_URI=http://127.0.0.1:9876/callback
```

Profiles are stored in `~/.neurocli/auth-profiles.json`. Config is stored in `~/.neurocli/config.toml`.

## Install and run

```bash
npm install
npm run build
node dist/index.js --help
```

Install globally from npm after publish:

```bash
npm install -g neuro-cli
neuro --help
```

Run the TUI:

```bash
npm run dev
```

Run a one-shot chat:

```bash
node dist/index.js chat "Explain this repository"
```

Run the agent loop:

```bash
node dist/index.js agent "Inspect the project and summarize the highest-risk gaps"
```

Show recent history and tracked token usage:

```bash
node dist/index.js history list --limit 10
node dist/index.js history show <entry-id>
node dist/index.js history clear
node dist/index.js cost
```

Show or update config:

```bash
node dist/index.js config show
node dist/index.js config set default.model openai/gpt-4.1
node dist/index.js config set aliases.review anthropic/claude-sonnet-4-0
```

Manage project context:

```bash
node dist/index.js context init
node dist/index.js context show
node dist/index.js context set "# NEURO.md\nPrioritize src first."
```

## Model routing

Default aliases live in `~/.neurocli/config.toml`:

- `fast` -> `openai/gpt-4.1-mini`
- `smart` -> `anthropic/claude-sonnet-4-0`
- `cheap` -> `google/gemini-2.5-flash`

Examples:

```bash
node dist/index.js chat "Hello" --model fast
node dist/index.js chat "Review this code" --model claude-sonnet-4-0
node dist/index.js chat "Summarize this file" --model google/gemini-2.5-pro
```

## Project instructions

If a project contains `NEURO.md` in the working directory, NeuroCLI injects that file as project-specific guidance for chat and agent requests.

## History and usage

NeuroCLI stores local chat history in `~/.neurocli/history.json`.

- `history` shows recent entries
- `history show <id>` prints a full stored exchange
- `history clear` removes stored exchanges
- `cost` shows total tracked tokens
- TUI also supports `/cost`, `/help`, `/model`, `/auth`, `/context`, `/history`, `/clear`, `/compact`, and `/exit`

## Verification

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

Detailed verification matrix:

- See [docs/verification-checklist.md](D:/VibeCoder/NeuroCli/docs/verification-checklist.md)

## Releases

The workflow at `.github/workflows/release.yml` builds and verifies the project on:

- Windows
- Linux

When you push a tag like `v0.2.0`, GitHub Actions will:

1. install dependencies
2. run tests, lint, and build
3. package the app for each platform
4. publish release assets on GitHub with changelog-based notes
5. publish `neuro-cli` to npm if `NPM_TOKEN` is configured in repository secrets

You can also run the packaging step locally:

```bash
npm run release:package
```
