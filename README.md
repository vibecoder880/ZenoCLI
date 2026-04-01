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
```

Profiles are stored in `~/.neurocli/auth-profiles.json`. Config is stored in `~/.neurocli/config.toml`.

## Install and run

```bash
npm install
npm run build
node dist/index.js --help
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

## Verification

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

## Releases

The workflow at `.github/workflows/release.yml` builds and verifies the project on:

- Windows
- Linux

When you push a tag like `v0.1.0`, GitHub Actions will:

1. install dependencies
2. run tests, lint, and build
3. package the app for each platform
4. publish release assets on GitHub

You can also run the packaging step locally:

```bash
npm run release:package
```
