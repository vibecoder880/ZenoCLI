# ZenoCLI — Architecture

**Version**: 0.7.0 (Phase 5 — TUI parity complete)
**Status**: Production-ready alpha

> The module map below reflects the current code (Phase 5, `CHANGELOG.md` 0.7.0) and supersedes any stale version claims elsewhere in this file or in older docs.

## Overview

ZenoCLI là một **intelligent agentic coding CLI** được thiết kế với parity gần hoàn chỉnh với Claude Code. Hỗ trợ nhiều LLM providers, tool system, multi-agent coordination, và safety controls.

## Core Architecture

```
User Input
    ↓
TUI / CLI (React/Ink)
    ↓
Agent Loop (orchestrator)
    ↓
┌─────────────────────────────────────────┐
│  Context Manager   │  Session Manager   │
│  - Token tracking  │  - JSONL persist   │
│  - Auto-compact    │  - Resume/fork     │
│  - Priority queue  │  - Auto-save       │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Permission System  │  Safety Classifier │
│  - 6 modes          │  - Rule-based      │
│  - Protected paths  │  - Risk levels     │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Tool Registry (dynamic)               │
│  - Built-ins: read_file, write_file,     │
│    edit_file, list_dir, glob, grep,      │
│    web_search, web_fetch, ask_user,      │
│    run_command                           │
│  - Orchestration stubs: spawn_subagent,  │
│    lsp_diagnostics                       │
│  - MCP tools (mcp__server__tool)         │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Providers                              │
│  - OpenAI (with native tool_use)        │
│  - Anthropic (with streaming + tools)   │
│  - Google (with function calling)       │
└─────────────────────────────────────────┘
```

## Module Map

### Core (`src/core/`)
- **context-manager.ts** — Token-aware context window, auto-compaction at 80%, eviction (tool outputs kept, then old turns)
- **session.ts** — JSONL session persistence under `~/.zenocli/projects/{hash}/sessions/`
- **memory.ts** — Cross-session memory (`MEMORY.md` global + per-project)
- **zeno-md.ts** — Hierarchical ZENO.md loader (global `~/.zenocli/ZENO.md`, root→cwd, `.zeno/rules/*.md`)
- **smart-context.ts** — File indexing, suggestion engine
- **prompt-cache.ts** — System prompt caching (5-min TTL, mtime invalidation)
- **context-budget.ts** — Per-turn budget management
- **update-checker.ts** — Version check against npm registry
- **stream.ts** — Provider text collector

### Agent (`src/agent/`)
- **loop.ts** — Intelligent agentic loop (per-turn corrections, auto-compaction, permission→hooks→checkpoint→`executeTool()`)
- **subagent.ts** — Isolated subagent spawning (typed presets: researcher, coder, tester, reviewer)
- **team.ts** — Team manager (`~/.zenocli/teams/{name}/config.json`)
- **task-list.ts** — File-based task coordination (`tasks.jsonl`)
- **messaging.ts** — Mailbox system (`messages/{teammate}.jsonl`)
- **plan-mode.ts** — Plan approval workflow (`.zeno/plans/{id}.md`, frontmatter + Steps)
- **agent-definitions.ts** — Custom agent types (markdown frontmatter: name/description/tools/model)
- **tool-registry.ts** — Dynamic tool registry (`ToolDefinition` with safety level, category, JsonSchema params)
- **tools/** — Built-in tools (fs, search, exec, orchestration)

### Safety (`src/safety/`)
- **permissions.ts** — 6 permission modes
- **classifier.ts** — Rule-based safety classifier
- **checkpoints.ts** — File snapshot + undo

### Plugins (`src/plugins/`)
- **mcp-client.ts** — Model Context Protocol client
- **mcp-tools.ts** — MCP tool registry integration
- **skill-loader.ts** — Skills system
- **hooks.ts** — Lifecycle hooks
- **lsp-client.ts** — Language Server Protocol
- **builtin/** — Built-in skills (review, fix, test)
- **index.ts** — Module index

### Agents (`src/agents/`)
- **researcher.md** — Read-only research
- **coder.md** — Implementation
- **reviewer.md** — Code review
- **tester.md** — Test writing
- **coordinator.md** — Team coordination

### Storage (`src/storage/`)
- **config.ts** — TOML config (`~/.zenocli/config.toml`) with permission/MCP/hooks sections
- **history.ts** — Chat history (`~/.zenocli/history.json`, cap 200)
- **paths.ts** — Path constants — app root `~/.zenocli`; sessions/memory under `~/.zenocli/projects/{hash}/…` (sha256[:16] of cwd); skills (global `~/.zenocli/skills`, project `.zeno/skills`, builtin); rules `.zeno/rules`; teams/tasks/mailbox; plans `.zeno/plans`

### Auth (`src/auth/`)
- **auth-profiles.ts** — API key + OAuth profiles (`~/.zenocli/auth-profiles.json`); profiles typed api_key|oauth|token, active-profile selection, expiry detection
- **oauth.ts** + **oauth-server.ts** — OAuth login flow (browser + local callback server on 127.0.0.1:9876, or `--manual-code`), refresh-token grant via `zeno auth refresh`; PKCE S256 + auto-refresh
- **device-code.ts** — Device Code Flow (RFC 8628) for headless login (`zeno auth login --method oauth --device`)

### CLI (`src/cli/`)
- **tui.tsx** — Ink/React TUI với welcome banner, sticky header/footer, multi-line input
- **slash-commands.ts** — Slash command definitions với category grouping
- **commands/** — Individual CLI commands: chat/agent support `--non-interactive`/`--pipe` headless output; `review` runs the reviewer subagent over a target or git diff
- **components/** — Header, MessageList, AgentStatus, Prompt, SlashMenu, Footer, WelcomeBanner; `DiffView` colors unified diffs (+green/-red) in message bubbles; `ModelsDialog` tier-grouped model picker; `ForkDialog` message-index session fork
- **hooks/** — useMultiLineInput, useFirstRun

### Providers (`src/providers/`)
- **base.ts** — `AiProvider` contract (`chat()` streaming, `listModels()`, `healthCheck()`). `ChatRequest` accepts an optional `signal?: AbortSignal` so an in-flight streaming request can be cancelled.
- **openai.ts** / **anthropic.ts** / **google.ts** — Provider adapters. Each passes `request.signal` into its SDK call (OpenAI `create(…, { signal })`, Anthropic `stream(…, { signal })`, Google `fetch(…, { signal })`)
- **openai-compatible.ts** — Generic OpenAI-wire-format adapter driven by `config.providers` (`type="openai-compatible"`, `baseURL`), unlocking 75+ providers
- **router.ts** — Model route resolution (explicit `provider/model`, alias, or prefix inference; `auto` routes through the SmartRouter)
- **smart-router.ts** — Super Kit-inspired `SmartRouter` selecting a model by `cost`/`quality`/`speed`/`balanced` strategy (drives `--model auto`)
- **model-registry.ts** — `ModelRegistry` with tier, quality score, latency, and pricing per model
- **router-fallback.ts** — Usable-route fallback (`[aliases.smart, aliases.fast, aliases.cheap, default.model]`)
- **pricing.ts** — Static pricing table + `estimateCostUsd()`
- **catalog.ts** — Provider catalog

## Data Flow

### Chat Flow
1. User submits prompt via TUI or CLI
2. Config loaded, usable route resolved (`selectUsableRoute` fallback)
3. Project instructions (`ZENO.md`) + memory loaded
4. Provider called; response collected via `collectProviderText` (streaming)
5. Response appended to TUI message list + persisted to `history.json`
6. Chat mode does not execute tool calls — that is the agent mode's job

### Agent Flow
1. Task submitted, context initialized (fresh `ContextManager` maxTokens window)
2. For each turn:
   a. Respect the abort signal (skip remaining work if cancelled)
   b. Check for mid-turn user corrections
   c. Auto-compact if needed
   d. Send to provider with tool definitions — via `collectProviderText(…, signal)`, retiring retryable provider errors with bounded exponential backoff (`maxRetries` / `--retries`)
   e. Handle tool calls (with permission → hooks → checkpoint → `executeTool()` with the abort signal forwarded in the tool context; `registerAllTools()` runs once at startup)
   f. Add results to context
3. Return final summary (result includes turns, totalTokens, toolsUsed, and `aborted: true` when cancelled)

`zeno agent` supports headless runs (`--non-interactive` / `--pipe`): plain machine-readable
stdout, errors to stderr, no TTY decorations, and exit code `130` when the loop aborts so a
cancelled CI/CD job fails cleanly. Interactive behavior is unchanged.

### Subagent Flow
1. Parent calls `spawnSubagent(options)` or `spawnTypedSubagent(type, options)`
2. New isolated ContextManager (50k window) created; default read-only tools
3. Typed presets: researcher (read-only), coder (+write/edit), tester (+run_command), reviewer (+run_command)
4. Subagent runs with restricted tools and returns `SubagentResult` (summary, tokens used, tools used)
5. Parent context stays clean (note: `filesChanged` in SubagentResult is not populated — always `[]` currently)
6. The `spawn_subagent` and `lsp_diagnostics` tools are orchestration stubs that error in tool context; real spawning uses the `src/agent/subagent.ts` functions

## Configuration

`~/.zenocli/config.toml`:
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
maxTokens = 100000
ignore = ["node_modules", ".git", "dist"]

[permission]
mode = "default"
autoApprove = {}

[mcp.servers.example]
command = "node"
args = ["server.js"]

[[hooks.PreToolUse]]
match = "edit_file"
command = "npx eslint --fix ${file}"
```

## Security Model

- **6 Permission Modes**: default, acceptEdits, plan, auto, dontAsk, bypassPermissions (cycled with `Shift+Tab` or `/permission`)
- **Protected Paths**: .git, .bashrc, .mcp.json, etc. (`isProtectedPath()` check on writes)
- **Safety Classifier**: Rule-based (regex + allow/block lists) — allows read-only tools and safe commands (install, git read, test/lint), blocks destructive shell commands and data exfiltration
- **Checkpoints**: Every file edit snapshot-able, undo-able (in-memory, max 100, `Esc+Esc` or `/undo`)
- **Hooks**: Custom validation before/after tool calls (`PreToolUse`/`PostToolUse`/`SessionStart`/`SessionEnd`/`Notification`) with template vars `${file} ${tool} ${cwd} ${result}`; `PreToolUse` can block

## Testing

- **40 test files** currently (`find src -name '*.test.ts' -o -name '*.test.tsx'`)
- Vitest framework (`vitest run`), TypeScript strict mode (`"strict": true`)
- CI runs `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm pack --dry-run` on Ubuntu and Windows
- Release gates include `npm run release:verify` (tests + typecheck + lint + build + pack) and `npm pack --dry-run`

## Roadmap

- ✅ Phase 1: Smart Agent Core
- ✅ Phase 2: Plugin & Safety System
- ✅ Phase 3: Multi-Agent System
- ✅ Phase 4: Polish & Integration
- ✅ Phase 5: TUI Parity với Claude Code (current) — see `CHANGELOG.md` 0.7.0
