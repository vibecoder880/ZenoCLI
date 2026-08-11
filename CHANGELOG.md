# Changelog

## 0.7.3 - 2026-08-12

### Features
- Super Kit-inspired smart model routing: `--model auto` picks the best model by strategy (`cost` / `quality` / `speed` / `balanced`) instead of a static alias
- Model registry with tier, quality score, latency, and pricing — expanded to 8 models including `claude-opus-4` and `gpt-4o`
- Budget tracking with optional daily/monthly USD limits, alert threshold, and automatic downgrade to the cost strategy when the budget is nearly used (`config.budget`)
- `zeno cost` now reports today's and the month's spend plus remaining budget and alerts
- Provider registry is config-driven: additional providers can be declared in `config.toml` `[providers]`

### Docs
- README documents `--model auto`, routing strategies, and budget config
- Architecture doc lists smart-router, model-registry, and budget-tracker modules

## 0.7.2 - 2026-08-11

### Features
- OAuth login now uses PKCE (S256) for the authorization-code flow: a local `code_verifier` is bound to the auth URL and sent only at token exchange, closing the interception attack on localhost callbacks
- New `zeno auth health` command validates stored credentials (api-key present, OAuth not expired, refresh token present) and exits non-zero when any provider is unhealthy
- OAuth access tokens auto-refresh when within 3 days of expiry at the `chat` / `agent` / TUI provider seam, using the stored refresh token with no full re-auth

### Security
- PKCE S256 challenge prevents misuse of an intercepted authorization code

### Notes
- Auto-refresh degrades gracefully: a failed refresh logs a warning and keeps using the stored token
- No new dependencies; PKCE is implemented with `node:crypto`

## 0.7.1 - 2026-08-11

### Bugfix + Harden release

### Features
- Multi-platform release packaging: artifacts are now built and named for linux-x64, windows-x64, and macos-x64
- Release notes are automatically categorized into Features / Fixes / Docs / Other instead of dumping the raw changelog
- macOS runners added to the release workflow matrix so every tagged version ships a macOS build

### Fixes
- Fix task-list file lock racing: atomic exclusive-create via `openSync("wx")` with stale-lock reclaim; lock file is unlinked on release so consecutive operations no longer time out
- Fix OAuth CSRF: the local redirect server now validates the `state` parameter and rejects mismatched callbacks
- Fix filesystem tools escaping the workspace: absolute and `../` paths are blocked at a single choke point
- Fix `run_command` safety bypasses: destructive recursive deletes and interpreter one-liners are rejected
- Fix hardcoded Windows-only test temp paths so the Ubuntu CI matrix runs clean

### Security
- Encrypt stored auth secrets (API keys, OAuth access/refresh tokens) at rest with AES-256-GCM using a machine-local key

## 0.7.0 - 2026-06-13

### Phase 5: TUI Parity với Claude Code

- **Welcome Banner**: ASCII logo, version, cwd, provider auth status, first-run detection với missing auth warning (auto-dismiss khi submit prompt đầu tiên)
- **Sticky Header**: 3 dòng (logo + version, provider/model, session · mode · permission · cost · tokens · history)
- **Footer Keybinding Hints**: Esc · / · Shift+Tab · Shift+Enter · ↑↓ với busy indicator
- **Multi-line Input**: Shift+Enter (hoặc Ctrl+Enter fallback) chèn newline, Enter vẫn submit, backspace merge dòng
- **Slash Palette Categories**: Mode / Session / Debug / Info grouping với highlight khi cuộn
- **Color-coded Messages**: User=cyan, Assistant=green, System=dim, Error=red
- **AgentStatus Event Colors**: tool_start=yellow, tool_result=green, error=red, permission=magenta, checkpoint=cyan
- **MessageList Lazy Trim**: Tối đa 50 message + placeholder `[... N earlier messages hidden ...]`
- **AgentStatus Rolling Buffer**: 20 dòng cuối
- **Cost Format**: sub-cent hiển thị 4 chữ số (`$0.0012`), cent-level 2 chữ số (`$1.23`)
- **First-Run Hook**: `useFirstRun` + `hasAnyActiveProfile()` + `listMissingProviders()` helpers trong auth-profiles
- **17 New Tests**: slash categories, useMultiLineInput, useFirstRun, Footer, WelcomeBanner

## 0.6.0 - 2026-06-13

### Phase 4: Polish & Advanced Integration

- **LSP Client**: Connect to language servers qua stdio (TypeScript, Python, Rust, Go). Auto-detect từ project config. Provide diagnostics, go-to-definition, find-references, hover
- **Smart Context Loader**: Track files đã seen, suggest relevant files based on task keywords, index-based search với tag inference
- **Prompt Cache**: Cache system prompts và NEURO.md với TTL. File mtime-based invalidation
- **Context Budget**: Per-turn token budget management với 4-zone allocation. Budget-aware tool selection
- **Update Checker**: Check for updates từ npm registry. Semver comparison
- **LSP Tool**: Expose diagnostics to agent via `lsp_diagnostics` tool
- **Documentation**: Architecture overview, plugin development guide
- **42 New Tests**: 5 new test files covering LSP, smart-context, prompt-cache, context-budget, update-checker

## 0.5.0 - 2026-06-13

### Phase 3: Multi-Agent System

- **Subagent Spawner**: Spawn isolated agents với fresh context window. Hỗ trợ 4 typed agents (researcher, coder, tester, reviewer) với preset tool sets. Concurrency limit (16), timeout, total limit (1000)
- **Task List System**: File-based task coordination với JSONL append-only. Hỗ trợ dependencies (blocks/blockedBy), claim với file lock, status tracking (pending/in_progress/completed/deleted)
- **Messaging/Mailbox**: Per-teammate mailbox tại `~/.neurocli/teams/{name}/messages/`. Message types: text, plan_approval, shutdown, task_update, broadcast. Mark read/unread
- **Team Manager**: Quản lý team lifecycle. Create/list/delete teams, add/remove members. Stored tại `~/.neurocli/teams/{name}/config.json`
- **Agent Definitions**: Load custom agent types từ markdown với frontmatter (name, description, tools, model, systemPrompt). Built-in agents: researcher, coder, reviewer, tester, coordinator
- **Plan Mode**: Agent đề xuất implementation plan, user review với approve/modify/reject. Plans stored tại `.neuro/plans/{id}.md` dạng markdown. Track status (draft/approved/rejected/executed)
- **55 New Tests**: 6 new test files covering task-list, messaging, team, plan-mode, agent-definitions, subagent

## 0.4.0 - 2026-06-13

### Phase 2: Plugin & Safety System

- **Permission System**: 6 permission modes (default, acceptEdits, plan, auto, dontAsk, bypassPermissions) cycled with Shift+Tab in TUI
- **Safety Classifier**: Rule-based classifier that blocks destructive shell commands, force pushes, data exfiltration, and writes to protected paths (`.git`, `.bashrc`, `.mcp.json`, etc.)
- **Checkpoint System**: Snapshots file contents before edit/write operations; supports undo via `/undo` slash command or Esc+Esc
- **MCP Client**: Stdio transport for Model Context Protocol servers with tool discovery, lazy-load schemas, auto-restart on failure (max 3 retries). Tool names namespaced: `mcp__server__tool`
- **Skills System**: Load skill markdown from `~/.neurocli/skills/`, `.neuro/skills/`, and built-in. User-invocable and model-invocable. Lazy-load content (descriptions loaded at session start)
- **Built-in Skills**: `/review`, `/fix`, `/test` skills bundled
- **Lifecycle Hooks**: PreToolUse, PostToolUse, SessionStart, SessionEnd, Notification events. Shell command hooks with template variables (`${file}`, `${tool}`, `${cwd}`). PreToolUse can block
- **Config Schema Extensions**: `permission`, `mcp`, `hooks` sections in `config.toml`
- **New Slash Commands**: `/permission` (cycle mode), `/undo` (restore last checkpoint)
- **58 New Tests**: 5 new test files covering permissions, classifier, checkpoints, hooks, skills

## 0.3.0 - 2026-06-11

### Phase 1: Smart Agent Core

- **Context Management System**: Token-aware context window tracking with auto-compaction at 80% threshold, priority-based eviction (tool outputs first, then old conversations), thrashing protection
- **Session Persistence**: Save/resume/fork sessions as JSONL files at `~/.neurocli/projects/{hash}/sessions/`. New CLI flags `--continue` and `--resume <id>`
- **Cross-Session Memory**: Auto-memory system that saves corrections, preferences, and patterns to MEMORY.md. Loads at session start (200 lines / 25KB limit)
- **Enhanced NEURO.md Loading**: Hierarchical loading from root to cwd, global `~/.neurocli/NEURO.md`, and `.neuro/rules/*.md` scoped rules
- **Dynamic Tool Registry**: Replaced hardcoded tool definitions with a dynamic registry supporting lazy-load schemas, safety levels, and categories
- **9 Built-in Tools**: `read_file` (with line ranges), `write_file`, `edit_file` (replace_all), `list_dir`, `glob`, `grep` (regex), `web_search` (DuckDuckGo), `web_fetch`, `ask_user`, `run_command`
- **Native Provider Tool Use**: All 3 providers (OpenAI, Anthropic, Google) now support native tool calling via API
- **Anthropic Streaming**: Anthropic provider now uses streaming API instead of blocking
- **Enhanced TUI**: Agent/chat mode toggle, real-time tool execution display, session tracking, mid-turn interrupt (Esc)
- **New Slash Commands**: `/memory`, `/resume`, `/fork`, `/context` (enhanced), `/compact` (real compaction)
- **44 New Tests**: 5 new test files covering tool-registry, context-manager, session, memory, neuro-md

## 0.2.0 - 2026-04-02

- Rename the npm package to `neuro-cli` and prepare it for global installation with `npm install -g neuro-cli`.
- Add a clean CLI/TUI foundation with chat, agent, auth, history, cost, config, context, health, and model discovery commands.
- Add provider routing plus adapters for OpenAI, Anthropic, and Google.
- Add local auth profile storage with API key support and configurable OAuth login flows for Google and OpenAI.
- Add local session history and tracked token usage.
- Add project-level context support through `NEURO.md`.
- Add GitHub Actions packaging for Windows and Linux plus GitHub Release publishing.
- Prepare npm publishing automation for tagged releases when `NPM_TOKEN` is configured.
