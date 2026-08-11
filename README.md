# ZenoCLI

ZenoCLI is a terminal coding assistant focused on a clean CLI, multiple model providers, local auth profile storage, and a pragmatic path to agentic workflows.

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
zeno auth login openai --method api-key
zeno auth login anthropic --method api-key
zeno auth login google --method api-key
zeno auth status
zeno auth refresh google
```

OAuth login is also supported:

```bash
zeno auth login google --method oauth
zeno auth login openai --method oauth --manual-code
zeno auth login google --method oauth --device   # headless: WSL/SSH/Docker/CI
```

`--device` uses Device Code Flow (RFC 8628) for environments where a browser
cannot reach the localhost callback: it shows a verification URL + code to
enter on another device, then polls until authorized.

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

Profiles are stored in `~/.zenocli/auth-profiles.json`. Config is stored in `~/.zenocli/config.toml`.

## Install and run

```bash
npm install
npm run build
node dist/index.js --help
```

Install globally from npm after publish:

```bash
npm install -g zeno-cli
zeno --help
zeno version
```

Run the TUI:

```bash
npm run dev
```

## Interactive TUI

Run `zeno` (no subcommand) to open the interactive TUI. It features:

- **Sticky header** (3 lines): logo + version, provider/model, then `session · mode · permission · cost · tokens · history`
- **Welcome banner** on first run (auto-dismisses on first prompt) with ASCII logo, cwd, and auth status per provider
- **Footer keybinding hints** (`Esc`, `/`, `Shift+Tab`, `Shift+Enter`, `↑↓`) with a busy indicator
- **Chat and agent modes**: chat streams a response; agent runs the local tool-using loop with live tool events, compacted context, and an interrupt (`Esc`)
- **Multi-line input**: `Enter` submits, `Shift+Enter` (or `Ctrl+Enter`) inserts a newline
- **Slash palette** grouped by category (Mode / Session / Debug / Info) with scroll highlight; filter is the substring after `/`, case-insensitive
- **Color-coded messages**: user=cyan, assistant=green, system=dim, error=red

Example layout (first-run, no auth yet):

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ ZenoCLI · v0.7.1                                                            │
│ openai/gpt-4.1-mini                                                          │
│ session <id> · chat · 🔒 Default (prompt for writes) · $0.0000 · 0 tok · 0   │
│ hist                                                                         │
╰──────────────────────────────────────────────────────────────────────────────╯

╭──────────────────────────────────────────────────────────────────────────────╮
│ ███╗   ██╗███████╗██╗   ██╗██████╗  ██████╗                                  │
│ ████╗  ██║██╔════╝██║   ██║██╔══██╗██╔═══██╗                                 │
│ ██╔██╗ ██║█████╗  ██║   ██║██████╔╝██║   ██║                                 │
│ ██║╚██╗██║██╔══╝  ██║   ██║██╔══██╗██║   ██║                                 │
│ ██║ ╚████║███████╗╚██████╔╝██║  ██║╚██████╔╝                                 │
│ ╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝                                  │
│                                                                              │
│ v0.7.1 · /path/to/project                                                    │
│                                                                              │
│ Providers                                                                    │
│ ✗ openai (no auth)                                                           │
│ ✗ anthropic (no auth)                                                        │
│ ✗ google (no auth)                                                           │
│                                                                              │
│ ⚠ Missing auth for: openai, anthropic, google                                │
│ Run: zeno auth openai                                                       │
│                                                                              │
│ Type a prompt to begin. Try /help for commands.                              │
╰──────────────────────────────────────────────────────────────────────────────╯

╭──────────────────────────────────────────────────────────────────────────────╮
│ Ready                                                                        │
╰──────────────────────────────────────────────────────────────────────────────╯

╭──────────────────────────────────────────────────────────────────────────────╮
│ Conversation is empty. Type a prompt to begin.                               │
╰──────────────────────────────────────────────────────────────────────────────╯

> Ask ZenoCLI to help (chat mode)

 Esc exit · / commands · Shift+Tab permission · Shift+Enter newline · ↑↓ history
```

Type a prompt and press `Enter` to send it. Press `/` to browse slash commands (use `↑`/`↓` to navigate, `Tab` to fill, `Enter` to run). Press `Esc` to exit.

See `docs/screenshots/tui-welcome.txt` for a captured TUI frame.

Run a one-shot chat:

```bash
node dist/index.js chat "Explain this repository"
```

Run the agent loop (defaults to `--max-turns 8`):

```bash
node dist/index.js agent "Inspect the project and summarize the highest-risk gaps"
node dist/index.js agent "Run the test suite and fix failures" --max-turns 12
```

Headless / CI mode — plain machine-readable output, no TTY decorations, prints the
final result to stdout and surfaces errors to stderr; a cancelled run exits `130`:

```bash
node dist/index.js agent "Fix the failing tests in src/core" --non-interactive
node dist/index.js agent "Apply the refactor" --pipe --max-turns 20 --retries 3
```

`--pipe` is an alias for `--non-interactive`. `--retries <n>` retries retryable
provider errors (rate limits / 5xx) with exponential backoff. Interactive mode is
unchanged. Runs can be cancelled with `Ctrl+C` (SIGINT) which aborts the loop cleanly.

Run a one-shot chat in headless mode (same plain-output contract as agent):

```bash
node dist/index.js chat "Summarize this file" --non-interactive
node dist/index.js chat "Fix this bug" --pipe
```

`--pipe` is an alias for `--non-interactive`. Chat headless prints only the
response text to stdout and routes errors to stderr; a cancelled run exits
non-zero.

Run a code review over a target or a git diff (exit 1 when findings exist, so
it can gate CI):

```bash
node dist/index.js review src/core/context-manager.ts
node dist/index.js review --diff HEAD~1 --non-interactive
node dist/index.js review --pipe --diff origin/main...HEAD
```

`--diff <ref>` reviews the files changed vs a git ref. The reviewer subagent
uses an economy-tier metadata model by default.

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
node dist/index.js context set "# ZENO.md\nPrioritize src first."
```

Run diagnostics:

```bash
node dist/index.js doctor
```

Bootstrap a workspace:

```bash
node dist/index.js init
```

## Model routing

Default aliases live in `~/.zenocli/config.toml`:

- `fast` -> `openai/gpt-4.1-mini`
- `smart` -> `anthropic/claude-sonnet-4-0`
- `cheap` -> `google/gemini-2.5-flash`

Examples:

```bash
node dist/index.js chat "Hello" --model fast
node dist/index.js chat "Review this code" --model claude-sonnet-4-0
node dist/index.js chat "Summarize this file" --model google/gemini-2.5-pro
```

### Smart routing (`--model auto`)

`zeno ... --model auto` routes through a Super Kit-inspired smart router that
picks the best model by strategy — `cost` / `quality` / `speed` / `balanced`
(default `balanced`). Configure the strategy in `~/.zenocli/config.toml`:

```toml
[routing]
strategy = "balanced"   # cost | quality | speed | balanced
```

Low-stakes tasks (subagent summaries, reviews) use an economy-tier
`metadataModel` by default so non-critical calls stay cheap:

```toml
metadataModel = "openai/gpt-4o-mini"
```

### OpenAI-compatible providers

Any endpoint speaking the OpenAI wire format can be added to `config.toml` —
OpenRouter, xAI, Azure, Groq, local Ollama, and hundreds more — without code:

```toml
[providers.openrouter]
type = "openai-compatible"
name = "OpenRouter"
baseURL = "https://openrouter.ai/api/v1"
apiKeyEnv = "OPENROUTER_API_KEY"

[providers.ollama]
type = "openai-compatible"
name = "Ollama (local)"
baseURL = "http://localhost:11434/v1"   # no apiKey needed for local servers
```

Then use it with `zeno chat "..." --provider openrouter --model <model-id>`.
The API key is read from `apiKeyEnv`; local servers can omit it.

### Budget tracking

Optional daily/monthly spend limits with automatic downgrade to the cost
strategy when the budget is nearly used:

```toml
[budget]
dailyLimitUsd = 2.0
monthlyLimitUsd = 50.0
alertThreshold = 0.8      # alert at 80% of budget
autoDowngrade = true      # route to cheap models when near the limit
```

`zeno cost` shows today's and the month's spend, remaining budget, and any
budget alert.

## Project instructions

If a project contains `ZENO.md` in the working directory, ZenoCLI injects that file as project-specific guidance for chat and agent requests.

## History and usage

ZenoCLI stores local chat history in `~/.zenocli/history.json`.

- `history` shows recent entries
- `history show <id>` prints a full stored exchange
- `history clear` removes stored exchanges
- `cost` shows total tracked tokens
- TUI slash commands are grouped by category: Mode (`/chat`, `/agent`, `/permission`, `/exit`), Session (`/clear`, `/memory`, `/resume`, `/fork`, `/undo`), Debug (`/cost`, `/health`, `/models`, `/context`, `/compact`), and Info (`/help`, `/init`, `/model`, `/auth`, `/history`, `/config`, `/version`)

## Verification

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

Detailed verification matrix:

- See [docs/verification-checklist.md](./docs/verification-checklist.md)

## Releases

The workflow at `.github/workflows/release.yml` builds and verifies the project on:

- Windows
- Linux
- macOS

When you push a tag like `v0.7.1`, GitHub Actions will:

1. install dependencies
2. run tests, lint, and build
3. package the app for each platform
4. publish release assets on GitHub with changelog-based notes
5. publish `zeno-cli` to npm if `NPM_TOKEN` is configured in repository secrets

You can also run the packaging step locally:

```bash
npm run release:package
npm run release:verify
```

Continuous verification for pushes and pull requests runs in:

- [.github/workflows/ci.yml](./.github/workflows/ci.yml)
