# Docs Update Scout Report — ZenoCLI

**Purpose:** Ground truth for refreshing README.md and docs/*.md against current code (2026-08-11).
**Status: DONE**
**Unresolved:** see "Doc accuracy flags" section.

## Module inventory (with public contracts)

### Agent (`src/agent/`)
- `loop.ts` — `runAgentLoop()` orchestrator: per-turn mid-turn corrections, auto-compaction, native tool definitions, permission→hooks→checkpoint→`executeTool()`. `AgentEvent` types: thought|tool_start|tool_result|final|compact|error|stream|permission|checkpoint. Import `.js` extension imports (NodeNext ESM). Tools registered once via `registerAllTools()`.
- `subagent.ts` — `spawnSubagent(options)/spawnTypedSubagent(type, options)/getSubagentStats()`. Fresh `ContextManager(50_000)`; default read-only tools (read_file, list_dir, glob, grep, web_search, web_fetch); typed presets: researcher (read-only), coder (+write/edit), tester (+run_command), reviewer (+run_command). Default model `anthropic/claude-sonnet-4-0`, maxTurns 10, timeout 5min, `MAX_CONCURRENT=min(16,cpus-2)`, `MAX_TOTAL=1000`. `SubagentResult={output, tokensUsed, filesChanged[], success, error?, turns, toolsUsed[]}`; **`filesChanged` always `[]` (TODO)**.
- `team.ts` — `TeamManager` create/load/addMember/removeMember/update/delete/exists/getMemberNames; `listTeams()`. Persisted `~/.zenocli/teams/{name}/config.json`.
- `task-list.ts` — `TaskList` JSONL append-only tasks + lock file (PID, 5s timeout). Task: `task_<8hex>`, status pending/in_progress/completed/deleted (soft delete).
- `messaging.ts` — `Mailbox` per-teammate JSONL mailboxes; types text/plan_approval_request/plan_approval_response/shutdown_request/shutdown_response/task_update/broadcast. Over `~/.zenocli/teams/{name}/messages/{teammate}.jsonl`.
- `plan-mode.ts` — `PlanManager` persists `.zeno/plans/{id}.md` (YAML frontmatter + Steps), status draft|approved|rejected|executed, user feedback on reject.
- `agent-definitions.ts` — `AgentDefinitionLoader` reads markdown frontmatter (name/description/tools/model). Built-ins in `src/agents/` (coder, coordinator, researcher, reviewer, tester).
- `tool-registry.ts` — `ToolDefinition` (name, description, parameters: JsonSchema, safety safe|moderate|dangerous, category fs|search|web|exec|orchestration, execute); `registerTool(s)/getTool/getAllTools/getToolSpecsForPrompt/getToolDefinitionsForApi/executeTool/clearRegistry`. `executeTool` swallows thrown errors → `{output:"",error}`. `ToolExecutionContext={cwd,ignore,askUser?,signal?}`.

### Built-in tool inventory (safety / category)
| Tool | Safety | Category | File |
|------|--------|----------|------|
| read_file | safe | fs | fs.ts |
| list_dir | safe | fs | fs.ts |
| glob | safe | fs | fs.ts |
| write_file | moderate | fs | fs.ts |
| edit_file | moderate | fs | fs.ts |
| grep | safe | search | fs.ts (defined here) |
| web_search | safe | web | search.ts |
| web_fetch | safe | web | search.ts |
| run_command | dangerous | exec | exec.ts (denylist + bounded timeout) |
| ask_user | safe | orchestration | orchestration.ts |
| spawn_subagent | moderate | orchestration | **stub** — errors in tool context; real = subagent.ts |
| lsp_diagnostics | safe | search | **stub** — errors in tool context |

### Safety (`src/safety/`)
- `permissions.ts` — 6 modes: `default|acceptEdits|plan|auto|dontAsk|bypassPermissions`. `PROTECTED_PATHS`, `isProtectedPath()`, `checkPermission()`, `nextPermissionMode()`, `permissionModeLabel()`.
  - default: reads auto-approved, prompt others (protected-path check).
  - acceptEdits: auto-approves write/edit + fs commands (unless protected path).
  - plan: read-only (block non-read).
  - auto: everything through classifier.
  - dontAsk: only pre-approved (autoApprove config); others blocked.
  - bypassPermissions: everything allowed (dangerous, container-only per comment).
- `classifier.ts` — `classifySafety(toolName, params, cwd?)` rule-based (regex + allow/block lists). Allows read-only tools & npm/pip install, yarn/pnpm add, git read ops, test/lint (npm test, npm run, vitest, jest, eslint, tsc). Blocks: destructive shell (rm -rf /, force push, hard reset origin, curl|sh, chmod -R 777, dd, format, package removal, npm publish, docker rm -f, kill -9 1, shutdown, reboot), exfiltration (curl -d/--data/-X POST/PUT/PATCH, wget --post), writes to protected paths. Default unknown risk = medium (allowed).
- `checkpoints.ts` — `CheckpointManager` in-memory snapshot before write/edit; undo via Esc+Esc; max 100; no git required.

### Core (`src/core/`)
- `context.ts` — `loadProjectInstructions(cwd)` reads **cwd/ZENO.md only** (one-shot `zeno chat`). Superseded by zeno-md.ts in TUI.
- `memory.ts` — `loadMemory`, `saveMemory`, `saveCorrection/Preference/Pattern`, `readFullMemory`, `writeProjectMemory`, `getMemorySummary`. Global `~/.zenocli/MEMORY.md` + project memory; truncated 200 lines/25KB; injected pinned.
- `zeno-md.ts` — hierarchical: `~/.zenocli/ZENO.md` global → ZENO.md walked root→cwd → `.zeno/rules/*.md`. `getMergedInstructions(cwd)`, `getInstructionsSummary`, `loadAllInstructions`.
- `smart-context.ts` — `SmartContextLoader` index/buildIndex(maxFiles=1000)/markSeen/getSeenFiles/suggestForTask/getStats/getSummary. Vietnamese comments.
- `prompt-cache.ts` — `PromptCache` 5-min TTL + mtime invalidation. Hit/miss counters NOT auto-incremented on `get`.
- `context-budget.ts` — `ContextBudget` split system 20%/context 55%/output 20%/tools 5%; drops web_search/web_fetch when utilization >80%.
- `update-checker.ts` — `checkForUpdates` npm registry (5s timeout); `printUpdateNotification`; cache `~/.zenocli/.update-check`. Prints `⚠️ Update available... npm install -g zeno-cli@latest`.
- `context-manager.ts` — token-aware window, 80% compact threshold, evict oldest tool outputs (keep 2) then old conversation turns (keep 4 pairs), thrash guard @3. Pinned = system/ZENO.md/memory/task.
- `session.ts` — JSONL at `~/.zenocli/projects/{hash}/sessions/{id}.jsonl` + `.meta.json`. `SessionWriter/Reader`, `listSessions`, `getLatestSessionId`, `forkSession`, `deleteSession`. ID `YYYYMMDD-<8hex>`.

### Storage (`src/storage/`)
- `history.ts` — flat `history.json` (cap 200), `appendHistoryEntry/listHistoryEntries/getHistoryEntry/clearHistory/summarizeTokenUsage`.
- `paths.ts` — app root `~/.zenocli`. Provides all paths: projects hash (sha256[:16]), sessions, memory (global+project), rules `.zeno/rules`, skills (global `~/.zenocli/skills`, project `.zeno/skills`, builtin), teams/tasks/mailbox, plans `.zeno/plans`.
- `config.ts` — TOML `~/.zenocli/config.toml` via @iarna/toml. Keys: default.model/.provider/.streaming; aliases (fast/smart/cheap); context.maxTokens (100000)/context.ignore; permission.mode/.autoApprove; mcp.servers.{name} (command/args/env); hooks (PreToolUse/PostToolUse/SessionStart/SessionEnd/Notification).

### Providers (`src/providers/`)
- `base.ts` — `AiProvider` contract: `chat(): AsyncIterable<StreamEvent>` (text|tool_call|done|error), `listModels()`, `healthCheck()`. `ToolCall`, `ToolSpec`, `RichMessage`, `ModelInfo`, `ProviderStatus`.
- Adapters: openai.ts, anthropic.ts, google.ts. `createProvider(slug)` / `tryCreateProvider(slug)` / `listProviderCatalog()`.
- `router.ts` — `resolveModelRoute(config, model?, provider?)`: explicit `provider/model`, alias, or inference from prefixes (gpt/o1/o3→openai, claude→anthropic, gemini→google). source explicit|alias|default. `auto` → aliases.smart.
- `router-fallback.ts` — `selectUsableRoute`: tries requested; if explicit request fails → throws; else falls back `[aliases.smart, aliases.fast, aliases.cheap, default.model]`, first whose `tryCreateProvider` succeeds. A provider is "usable" iff `resolveProviderSecret` returns secret (env wins, then preferred non-expired profile; oauth prefers access token).
- `pricing.ts` — static table keyed `provider/model`: openai/gpt-4.1 $2/$8, gpt-4.1-mini $0.4/$1.6, gpt-4o-mini $0.15/$0.6, anthropic/claude-sonnet-4-0 $3/$15, google/gemini-2.5-pro $1.25/$10, gemini-2.5-flash $0.3/$2.5 (per M in/out USD). `estimateCostUsd` rounded 6 dec; `undefined` for unknown → treated as $0. Agent mode TUI passes `totalTokens` and `totalTokens/2` heuristic (not real split).
- `catalog.ts` — PROVIDER_CATALOG.

### Auth (`src/auth/`)
- `auth-profiles.ts` — `AuthProfileStore` (JSON `~/.zenocli/auth-profiles.json`): types api_key|oauth|token; `saveProfile/removeProfile/setActiveProfile/getActiveProfile/getPreferredProfile/markCooldown/updateProfile`. `isProfileExpired`, `maskSecret`, `hasAnyActiveProfile`, `listMissingProviders`, KNOWN_PROVIDERS=[openai,anthropic,google]. Profile score: oauth 3 > token 2 > api_key 1.
- `oauth.ts` + `oauth-server.ts` — env vars:
  - Google: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` (required); optional `GOOGLE_OAUTH_REDIRECT_URI` (default `http://127.0.0.1:9876/callback`), `GOOGLE_OAUTH_SCOPES` (default `openid email profile`). Fixed URLs, `access_type=offline`, `prompt=consent`.
  - OpenAI: `OPENAI_OAUTH_AUTH_URL`, `OPENAI_OAUTH_TOKEN_URL`, `OPENAI_OAUTH_CLIENT_ID` (required); optional `OPENAI_OAUTH_CLIENT_SECRET`, `OPENAI_OAUTH_REDIRECT_URI`, `OPENAI_OAUTH_SCOPES` (default `openid profile email offline_access`), `OPENAI_OAUTH_USERINFO_URL`, `OPENAI_OAUTH_USERINFO_EMAIL_FIELD` (default `email`).
  - Flow: browser open (or print URL) → code via local callback server (127.0.0.1:9876, 120s) or `--manual-code` → token exchange (form POST, client_secret if set) → userinfo email → save OAuth profile. `zeno auth refresh <provider> [--profile <id>]` uses refresh_token grant. Auto-refresh does NOT happen on read; expired profiles treated as missing.

### Safety/plugins
- hooks.ts — `HookRunner` addHook/addHooks/getHooks/fire/clear/count; `loadHooksFromConfig()`. Events PreToolUse/PostToolUse/SessionStart/SessionEnd/Notification. `match` substring on toolName; template vars `${file} ${tool} ${cwd} ${result}`; PreToolUse can block.
- mcp-client.ts — JSON-RPC over stdio, init handshake protocol `2024-11-05` (client "neurocli" v0.3.0), tools/list, resources/list, tools/call; 30s timeout, auto-restart ≤3 retries. `McpManager`.
- mcp-tools.ts — `mcpToolName(serverName, toolName)` → `mcp__{server}__{tool}`; `registerMcpTools(manager)`. Category web, safety moderate.
- skill-loader.ts — `SkillLoader` markdown frontmatter (name/description/trigger user-invocable|model-invocable/context inline|fork). Load from `~/.zenocli/skills/` (global), `.zeno/skills/` (project), `src/plugins/builtin/` (bundled review/fix/test).
- lsp-client.ts — `LspManager`, `detectLspServers`, diagnostics/go-to-definition/references/hover. Auto-detect from project config.

## CLI + TUI surface

- CLI subcommands (index.ts): default TUI + `chat`, `agent` (--max-turns 8), `history list|show|clear`, `cost`, `health`, `models [provider]`, `config show|set`, `context show|init|set`, `doctor`, `init`, `version`, `auth` (login|list|switch|remove|status|refresh). Global flags: `-m/--model`, `-p/--provider`, `--cwd`, `--prompt`, `--continue`, `--resume`. `OPENAI_MODEL` env = default `-m`.
- TUI (tui.tsx): AppMode chat|agent; ScreenMode welcome|chat. Streaming via `collectProviderText` (chat) or `runAgentLoop` (agent). Cost via estimateCostUsd (agent TUI usage heuristic). **`continueSession`/`resumeSessionId` props accepted but NOT read in ChatApp** — every launch creates fresh SessionWriter; `/resume` lists sessions only (real resume = `zeno --resume <id>` at CLI). `/init`, `/version` are stubs ("Run: zeno init"). `/model` prints requested vs active.
- Slash commands (all 21): help,init,model,auth,history,config,version=info; chat,agent,permission,exit=mode; clear,memory,resume,fork,undo=session; cost,health,models,context,compact=debug. Filter = substring after `/`, case-insensitive.
- `zeno doctor [cwd]` checks: node version, storage files exist, config defaults, provider env vars + stored profiles, per-provider `healthCheck()`, release readiness (NPM_TOKEN, package name).

## Doc-accuracy flags (fix in docs)
1. `docs/architecture.md` says `~/.Zenocli` — actual is lowercase `~/.zenocli` (paths.ts). Also references NEURO.md/neuro paths; project renamed neuro-cli→zeno-cli. Version header in architecture.md says 0.6.0/Phase 4, but CHANGELOG tops at 0.7.0 (Phase 5). Test count claim "221 tests / 36 files" — actual 40 test files currently.
2. `docs/plugin-development.md` says `~/.Zenocli/` and `~/.Zenocli/agents/` — lowercase `~/.zenocli/`. MCP client name in code is "neurocli" (legacy). Built-in skills live at `src/plugins/builtin/` (review, fix, test).
3. `README.md` — version 0.2.0; references `D:/VibeCoder/ZenoCLI/docs/...` absolute Windows paths (broken links); model alias defaults correct.
4. `package.json` version is 0.2.0; CHANGELOG newest entry 0.7.0; release-manifest.json stale artifact (ClaudeKit, v2.20.0) — not doc-relevant but note it's stale.
5. `spawn_subagent` & `lsp_diagnostics` are orchestration tool stubs (error in tool context); real spawning = subagent.ts functions. Don't oversell their availability to the agent.
6. `filesChanged` in SubagentResult always `[]`.

## Files to update (per update-workflow.md)
- README.md (keep <300 lines; currently 251)
- docs/architecture.md (correct paths, version, test totals; optionally new module spans)
- docs/plugin-development.md (path case + accuracy pass)
- docs/verification-checklist.md (add change-initiated items if any; keep concise)
- No project-overview-pdr.md / codebase-summary.md / code-standards.md / system-architecture.md / project-roadmap.md / deployment-guide.md exist yet — do NOT create unless requested (scope = update).