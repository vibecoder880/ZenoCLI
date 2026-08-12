# ZenoCLI

> **A professional, multi-provider terminal coding agent** — Claude Code class power, open source, and 75+ LLM providers.

ZenoCLI is a terminal coding agent with an interactive Ink TUI, a local
tool-using agent loop, smart multi-provider routing, budget tracking, code
review, MCP server support, and lifecycle hooks. It runs on Node.js 22+ for
Windows, Linux, and macOS.

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ ZenoCLI · v0.7.7                                                            │
│ anthropic/claude-sonnet-4-0                                                  │
│ session abc123 · agent · 🔒 Default (prompt for writes) · $0.0012 · 1.2k tok │
╰──────────────────────────────────────────────────────────────────────────────╯

> Refactor the parser to use async iterators.
→ run_command ✓ 18 tests passed
✎ edit_file  +124 −38

  @@ -142,7 +142,8 @@
  -  const items: string[] = [];
  +  for await (const chunk of stream) { ... }

✓ Refactored parser to async iterators. (Turns: 4 · Tokens: 1,240)
```

See [the full TUI layout](#giao-dien-tui) below.

## Table of contents

- [Features](#features)
- [Install](#install)
- [Quick start](#quick-start)
- [Giao diện TUI](#giao-dien-tui)
- [CLI commands](#cli-commands)
- [Configuration](#configuration)
- [Providers & routing](#providers--routing)
- [Auth](#auth)
- [MCP servers](#mcp-servers)
- [Hooks](#hooks)
- [Development](#development)
- [Releases](#releases)

## Features

| Area | What you get |
|------|-------------|
| **TUI** | Ink-based interface with sticky header, welcome banner, slash palette, theme system (dark/light/custom), colorized diff viewer, live agent stream |
| **Providers** | OpenAI, Anthropic, Google + any OpenAI-compatible endpoint (OpenRouter, xAI, Azure, Groq, local Ollama) — 75+ from `config.toml` |
| **Agent loop** | Streaming events, context compaction, mid-turn corrections, AbortSignal cancellation, bounded retry |
| **Smart routing** | `--model auto` by cost / quality / speed / balanced, with budget limits + auto-downgrade |
| **Chat & review** | One-shot chat, headless CI mode, and `zeno review` that gates PRs by severity |
| **Auth** | Encrypted API-key profiles, PKCE OAuth, auto-refresh, Device Code Flow for headless |
| **Extensibility** | 7 lifecycle hooks (claude-code parity), custom slash commands, MCP servers |
| **Multi-agent** | Subagents with isolated context, code review, team/task coordination |

## Install

```bash
# from source
npm install
npm run build
node dist/index.js --help

# global (after npm publish)
npm install -g zeno-cli
zeno --help
```

## Quick start

```bash
# Interactive TUI
zeno                # or `npm run dev`

# One-shot chat
zeno chat "Explain this repository"

# Agent loop (tool-using, context-aware)
zeno agent "Run the test suite and fix failures" --max-turns 12

# Headless for CI/CD
zeno agent "Fix the failing tests" --non-interactive
zeno chat "Summarize this file" --pipe

# Code review (exit 1 when findings exist — gates PRs)
zeno review src/core/context-manager.ts
zeno review --diff HEAD~1 --non-interactive
```

## Giao diện TUI

Run `zeno` (no subcommand) to open the interactive TUI.

**First run** (no auth yet) shows the welcome banner:

```text
╭──────────────────────────────────────────────────────────────────────────────╮
│ ZenoCLI · v0.7.7                                                            │
│ openai/gpt-4.1-mini                                                          │
│ session abc123 · chat · 🔒 Default (prompt for writes) · $0.0000 · 0 tok ·   │
│ 0 hist                                                                       │
╰──────────────────────────────────────────────────────────────────────────────╯

╭──────────────────────────────────────────────────────────────────────────────╮
│ ███╗   ██╗███████╗██╗   ██╗██████╗  ██████╗                                  │
│ ████╗  ██║██╔════╝██║   ██║██╔══██╗██╔═══██╗                                 │
│ ██╔██╗ ██║█████╗  ██║   ██║██████╔╝██║   ██║                                 │
│ ██║╚██╗██║██╔══╝  ██║   ██║██╔══██╗██║   ██║                                 │
│ ██║ ╚████║███████╗╚██████╔╝██║  ██║╚██████╔╝                                 │
│ ╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝                                  │
│                                                                              │
│ v0.7.7 · /path/to/project                                                    │
│                                                                              │
│ Providers                                                                    │
│ ✗ openai (no auth)                                                           │
│ ✗ anthropic (no auth)                                                        │
│ ✗ google (no auth)                                                           │
│                                                                              │
│ ⚠ Missing auth for: openai, anthropic, google                                │
│ Run: zeno auth openai                                                       │
│                                                                              │
│ Type a prompt to begin. Try /help for commands. Banner dismisses on first    │
│ prompt.                                                                      │
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

**Everyday use** — header shows session/mode/permission/cost, messages are
color-coded (user cyan, assistant green, system dim), the agent stream prints
live tool events, and file edits render as a colorized diff:

```text
╭──────────────────────────────────────────────────────────────────────────────╮
│ ZenoCLI · v0.7.7                                                            │
│ anthropic/claude-sonnet-4-0                                                  │
│ session abc123 · agent · 🔒 Default (prompt for writes) · $0.0012 · 1.2k tok │
╰──────────────────────────────────────────────────────────────────────────────╯

▸ You
  Refactor the parser to use async iterators.

◆ Assistant
  ✎ edit_file(parser.ts)   ✓ 124 insertions, 38 deletions

  @@ -142,7 +142,8 @@
  -  const items: string[] = [];
  +  for await (const chunk of stream) { ... }

  ✓ Refactored parser to async iterators.
  Turns: 4 | Tokens: 1,240 | Tools: run_command, edit_file, read_file

> Ask ZenoCLI to help (agent mode)

 Esc exit · / commands · Shift+Tab permission · Shift+Enter newline · ↑↓ history
```

**Keybindings:**

| Key | Action |
|-----|--------|
| `Enter` | Submit |
| `Shift+Enter` / `Ctrl+Enter` | Newline |
| `/` | Open slash palette |
| `↑` / `↓` | Navigate (palette / history) |
| `Tab` | Fill highlighted command |
| `Shift+Tab` | Cycle permission mode |
| `Esc` | Exit / interrupt busy agent |

**Slash commands** are grouped by category: Mode (`/chat`, `/agent`,
`/permission`, `/exit`), Session (`/clear`, `/memory`, `/resume`, `/fork`,
`/undo`), Debug (`/cost`, `/health`, `/models`, `/context`, `/compact`), Info
(`/help`, `/init`, `/model`, `/auth`, `/history`, `/config`, `/version`). The
palette floats recently-used commands first.

## CLI commands

| Command | Description |
|---------|-------------|
| `zeno` | Launch the interactive TUI |
| `zeno chat "<prompt>"` | One-shot chat (`--non-interactive`/`--pipe` for CI) |
| `zeno agent "<task>"` | Tool-using agent loop (`--max-turns`, `--retries`, headless flags) |
| `zeno review [target]` | Code review by target or `--diff <ref>` (exit 1 = findings) |
| `zeno auth` | Login / list / switch / status / health / refresh, OAuth + device flow |
| `zeno mcp` | List configured MCP servers; `--verify <name>` shows tools |
| `zeno history` | list / show / clear |
| `zeno cost` | Token usage + budget status (today/month, remaining, alerts) |
| `zeno models` | List providers, aliases, and models |
| `zeno config` | show / set (`set default.model openai/gpt-4.1`) |
| `zeno context` | show / init / set (project `ZENO.md`) |
| `zeno doctor` | Inspect runtime, config, credentials |
| `zeno init` | Bootstrap a workspace |
| `zeno health` | Provider health check |
| `zeno version` | Print version |

## Configuration

All user state lives under `~/.zenocli/`. The main file is `config.toml`:

```toml
[default]
model = "openai/gpt-4.1-mini"
provider = "openai"
streaming = true

[aliases]
fast = "openai/gpt-4.1-mini"
smart = "anthropic/claude-sonnet-4-0"
cheap = "google/gemini-2.5-flash"

[context]
maxTokens = 100_000
ignore = ["node_modules", ".git", "dist"]

[permission]
mode = "default"        # default | acceptEdits | plan | auto | dontAsk | bypassPermissions

[routing]
strategy = "balanced"   # cost | quality | speed | balanced — for `--model auto`

metadataModel = "openai/gpt-4o-mini"   # economy model for low-stakes summaries

[theme]
mode = "dark"           # dark | light
[theme.palette]
primary = "magenta"     # optional color overrides (Ink color names)

[budget]
dailyLimitUsd = 2.0
monthlyLimitUsd = 50.0
alertThreshold = 0.8
autoDowngrade = true
```

## Providers & routing

### OpenAI-compatible providers (75+)

Any endpoint speaking the OpenAI wire format works from config — no code:

```toml
[providers.openrouter]
type = "openai-compatible"
name = "OpenRouter"
baseURL = "https://openrouter.ai/api/v1"
apiKeyEnv = "OPENROUTER_API_KEY"

[providers.ollama]
type = "openai-compatible"
name = "Ollama (local)"
baseURL = "http://localhost:11434/v1"   # local servers can omit the API key
```

```bash
zeno chat "..." --provider openrouter --model <model-id>
```

### Smart routing

`--model auto` routes through a Super Kit-inspired smart router that picks the
best model by strategy — `cost` / `quality` / `speed` / `balanced` (default
`balanced`). Under budget pressure it auto-downgrades to `cost`. Low-stakes
tasks use the economy `metadataModel`.

## Auth

```bash
# API keys (encrypted at rest)
zeno auth login openai --method api-key
zeno auth status
zeno auth health          # validate stored credentials, exit 1 if unhealthy

# OAuth (browser + localhost callback, PKCE S256, auto-refresh)
zeno auth login google --method oauth
zeno auth login openai --method oauth --manual-code

# Device Code Flow (WSL/SSH/Docker/CI where localhost is unreachable)
zeno auth login google --method oauth --device
```

Secrets are encrypted with AES-256-GCM and a machine-local key; profiles live
in `~/.zenocli/auth-profiles.json`.

OAuth env vars: `GOOGLE_OAUTH_CLIENT_ID`/`_SECRET`/`_REDIRECT_URI` and
`OPENAI_OAUTH_AUTH_URL`/`_TOKEN_URL`/`_CLIENT_ID`/`_CLIENT_SECRET`/`_REDIRECT_URI`.

## MCP servers

Servers declared in `[mcp.servers]` are started when the agent runs; their
tools become callable as `mcp__<server>__<tool>`:

```toml
[mcp.servers.filesystem]
command = "npx"
args = ["tsx", "node_modules/super-kit/core/mcp-servers/filesystem/server.ts"]
```

```bash
zeno mcp                      # list configured servers
zeno mcp --verify filesystem  # start it and show its tools
```

super-kit ships 5 MCP servers you can point at: filesystem, git, database,
browser, and vietnam (Zalo messaging + Vietnamese NLP).

## Hooks

The agent fires 7 lifecycle events (claude-code parity): `PreToolUse`,
`PostToolUse`, `SessionStart`, `SessionEnd`, `Notification`, `Stop`,
`SubagentStop`. Each can run a shell command or inject a prompt:

```toml
[hooks.Stop]
command = "echo 'agent finished'"

[hooks.SubagentStop]
command = "node scripts/notify.mjs"
```

## Custom slash commands

Define reusable `/command`s that send a prompt template:

```toml
[commands.refactor]
prompt = "Refactor the current file for clarity, keeping behavior identical."

[commands.changelog]
prompt = "Summarize the last 10 commits into a changelog entry."
```

Type `/refactor` (or `/refactor with notes`) in the TUI to run it.

## Development

```bash
npm run dev          # interactive TUI via tsx (no build)
npm run build        # tsc -> dist/
npm run typecheck    # tsc --noEmit
npm run test         # vitest (all tests)
npm run lint         # eslint
npm run release:verify
```

Tests are colocated as `*.test.ts` beside their source; Ink components use
`ink-testing-library`.

## Releases

Pushing a `v*` tag triggers `.github/workflows/release.yml`, which verifies,
packages, and publishes linux / windows / macOS archives with changelog-based
notes, plus npm if `NPM_TOKEN` is set.

```bash
npm run release:package   # local packaging into release/
npm run release:verify    # test + typecheck + lint + build + pack --dry-run
```

---

**License:** MIT · **Author:** qkhalk · **Home:** https://github.com/vibecoder880/ZenoCLI