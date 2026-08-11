# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ZenoCLI is a TypeScript terminal coding agent (Claude Code–like) that supports multiple LLM providers, a local tool-using agent loop, an Ink-based TUI, local auth profile storage, and OAuth flows. It is an ESM package (`"type": "module"`, NodeNext resolution) targeting Node 22+.

## Commands

```bash
npm install

npm run dev          # Run the interactive TUI via tsx (no build needed)
npm run build        # Compile with tsc -> dist/
npm run typecheck    # tsc --noEmit
npm run test         # Vitest, run all tests
npm run lint         # ESLint (flat config: eslint.config.mjs)
npm run release:verify   # test + typecheck + lint + build + npm pack --dry-run
npm run release:package  # Build platform release artifacts into release/ (local)
```

Run a single test file or a filtered test:

```bash
npm run test -- src/core/context-manager.test.ts   # one file
npm run test -- -t "compaction"                    # name filter across suite
```

Tests are colocated as `*.test.ts` / `*.test.tsx` beside their source. Ink/React components are tested with `ink-testing-library`. There is no `vitest.config.*` — Vitest runs on defaults.

`prepublishOnly` (test + lint + build) runs before `npm publish`. Release workflow: pushing a `v*` tag triggers `.github/workflows/release.yml`, which verifies, packages per-OS via `scripts/package-release.mjs`, and publishes GitHub release notes + npm (if `NPM_TOKEN` is set).

## Architecture

### Entry point and CLI

`src/index.ts` is a `commander` program. It registers subcommands (`chat`, `agent`, `history`, `cost`, `health`, `models`, `config`, `context`, `doctor`, `init`, `version`) and routes to `src/cli/commands/*.ts`. Running `zeno` with no subcommand launches the Ink TUI (`src/cli/tui.tsx`), which shares the same provider/context/session machinery as the CLI commands.

### Providers (`src/providers/`)

`base.ts` defines the `AiProvider` contract: each provider's `chat()` returns an `AsyncIterable<StreamEvent>` (`text` / `tool_call` / `done` / `error`). Adapters live in `openai.ts`, `anthropic.ts`, `google.ts`; `index.ts`'s `createProvider(slug)` builds one from an `AuthProfileStore`. `router.ts` resolves model strings → `{ provider, model }` (explicit `provider/model`, alias, or inference from prefixes like `gpt`/`claude`/`gemini`); `router-fallback.ts` picks a usable route across providers. `core/stream.ts`'s `collectProviderText()` is the shared consumer that accumulates streamed text and tool calls into a `CollectResult` — both chat/agent commands and the TUI use it.

### Agent loop (`src/agent/`)

`loop.ts`'s `runAgentLoop()` is the orchestrator: per turn it checks mid-turn user corrections, auto-compacts context, sends messages with native tool definitions, then executes tool calls through permission checks → pre/post hooks → checkpoints → `executeTool()`. Tools are registered dynamically in `tool-registry.ts` (a `Map<string, ToolDefinition>` with JSON-Schema params, safety level, and category). `registerAllTools()` from `tools/index.ts` must run before any tool executes; `tools/` contains fs/search/exec/orchestration tool groups. Other modules here: `subagent.ts` (isolated spawned agents with restricted tools), `team.ts`/`task-list.ts`/`messaging.ts` (multi-agent coordination), `plan-mode.ts`.

### Core (`src/core/`)

- `context-manager.ts` — token-aware window with pinned entries (system prompt, ZENO.md, memory) and a two-phase compaction eviction strategy (oldest tool outputs, then old conversation turns, with thrash protection).
- `session.ts` — JSONL session persistence (`SessionWriter`/`SessionReader`, list/fork/delete; `--continue`/`--resume` in the CLI).
- `memory.ts`, `zeno-md.ts` — cross-session MEMORY.md and hierarchical `ZENO.md` project-instruction loading.
- `smart-context.ts`, `context-budget.ts`, `prompt-cache.ts`, `update-checker.ts`, `stream.ts`.

### Safety and plugins

`safety/` has `permissions.ts` (6 permission modes: default, acceptEdits, plan, auto, dontAsk, bypassPermissions), `classifier.ts` (rule-based risk classification used in auto mode), and `checkpoints.ts` (file snapshot + undo). `plugins/` wires MCP client/tools, skill loading (markdown skills with frontmatter from builtin/global/project dirs), lifecycle hooks (`PreToolUse`/`PostToolUse`/...), and LSP. Docs: `docs/plugin-development.md`. Agent "personas" are plain markdown prompts in `src/agents/` (coder, reviewer, tester, researcher, coordinator).

## Storage and config locations

All user state lives under `~/.zenocli/` (lowercase; `docs/architecture.md` says `~/.Zenocli`, out of date):

- `config.toml` — defaults, model aliases (`fast`/`smart`/`cheap`), context budget, permission mode, MCP servers, hooks. Loaded/merged via `src/storage/config.ts`.
- `auth-profiles.json` — API key, OAuth, and token profiles per provider (`src/auth/auth-profiles.ts`). Secrets are stored here and in provider SDK clients.
- `history.json` — chat history for the `history`/`cost` commands.
- `projects/{sha256(cwd)[:16]}/sessions/{id}.jsonl` + `.meta.json` — per-project session files; project-scoped memory/MEMORY.md shares the same hashed directory.

## Convention gotchas

- Local imports in `src/` use explicit `.js` extensions (`import { x } from "./y.js"`), required by NodeNext ESM.
- `tsconfig.json` excludes `*.test.ts(x)` from the `build` emit but keeps them in `types: ["vitest/globals"]`; tests import from `vitest` explicitly.
- Provider `chat()` implementations stream; views never assume a plain-text response — always go through `collectProviderText` for uniform text/tool-call/usage handling.
- Project instruction files: user-level `ZENO.md` in the working directory (injected as guidance), plus repo-level `CLAUDE.md`/.claude rules for this repo itself.