# NeuroCli — Architecture

**Version**: 0.6.0 (Phase 4 complete)
**Status**: Production-ready alpha

## Overview

NeuroCli là một **intelligent agentic coding CLI** được thiết kế với parity gần hoàn chỉnh với Claude Code. Hỗ trợ nhiều LLM providers, tool system, multi-agent coordination, và safety controls.

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
│  Tool Registry                         │
│  - Built-in tools (read, write, glob)   │
│  - MCP tools (mcp__server__tool)        │
│  - Skill tools                          │
│  - LSP tools (Phase 4)                  │
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
- **context-manager.ts** — Token-aware context window, auto-compaction
- **session.ts** — JSONL session persistence
- **memory.ts** — Cross-session memory (MEMORY.md)
- **neuro-md.ts** — Hierarchical NEURO.md loader
- **smart-context.ts** — File indexing, suggestion engine
- **prompt-cache.ts** — System prompt caching
- **context-budget.ts** — Per-turn budget management
- **update-checker.ts** — Version check
- **stream.ts** — Provider text collector

### Agent (`src/agent/`)
- **loop.ts** — Intelligent agentic loop
- **subagent.ts** — Isolated subagent spawning
- **team.ts** — Team manager
- **task-list.ts** — File-based task coordination
- **messaging.ts** — Mailbox system
- **plan-mode.ts** — Plan approval workflow
- **agent-definitions.ts** — Custom agent types
- **tool-registry.ts** — Dynamic tool registry
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
- **config.ts** — TOML config with permission/MCP/hooks
- **history.ts** — Chat history
- **paths.ts** — Path constants
- **auth-profiles.ts** — API key + OAuth profiles

### CLI (`src/cli/`)
- **tui.tsx** — Ink/React TUI với welcome banner, sticky header/footer, multi-line input
- **slash-commands.ts** — Slash command definitions với category grouping
- **commands/** — Individual CLI commands
- **components/** — Header, MessageList, AgentStatus, Prompt, SlashMenu, Footer, WelcomeBanner
- **hooks/** — useMultiLineInput, useFirstRun

### Providers (`src/providers/`)
- **base.ts** — AiProvider interface
- **openai.ts** — OpenAI adapter
- **anthropic.ts** — Anthropic adapter
- **google.ts** — Google adapter
- **router.ts** — Model route resolution
- **catalog.ts** — Provider catalog

## Data Flow

### Chat Flow
1. User submits prompt via TUI or CLI
2. Config loaded, model route resolved
3. Project instructions + memory loaded
4. Context manager prepares messages
5. Provider called (with native tool definitions)
6. Response collected (streaming)
7. If tool calls: execute, add to context, loop
8. If final: append to history, display

### Agent Flow
1. Task submitted, context initialized
2. For each turn:
   a. Check for mid-turn user corrections
   b. Auto-compact if needed
   c. Send to provider with tool definitions
   d. Handle tool calls (with permission + checkpoint + hooks)
   e. Add results to context
3. Return final summary

### Subagent Flow
1. Parent calls `spawnSubagent(task, type)`
2. New isolated ContextManager created
3. Subagent runs with restricted tools
4. Returns summary (not full conversation)
5. Parent context stays clean

## Configuration

`~/.neurocli/config.toml`:
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

- **6 Permission Modes**: default, acceptEdits, plan, auto, dontAsk, bypassPermissions
- **Protected Paths**: .git, .bashrc, .mcp.json, etc.
- **Safety Classifier**: Blocks destructive commands, data exfiltration
- **Checkpoints**: Every file edit snapshot-able, undo-able
- **Hooks**: Custom validation before/after tool calls

## Testing

- **221 tests** across 36 test files
- **100% pass rate**
- Vitest framework
- TypeScript strict mode
- ESLint clean
- Build clean

## Roadmap

- ✅ Phase 1: Smart Agent Core
- ✅ Phase 2: Plugin & Safety System
- ✅ Phase 3: Multi-Agent System
- ✅ Phase 4: Polish & Integration
- 🔜 Phase 5: Community features (plugin marketplace, etc.)
