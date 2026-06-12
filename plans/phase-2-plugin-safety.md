# Phase 2: Plugin & Safety System

**Mục tiêu**: Thêm MCP protocol support, skills system, lifecycle hooks, permission modes, và safety classifier.

**Duration estimate**: 2-3 weeks
**Status**: ✅ Completed

## 1. Permission & Safety Model

### 1.1 Permission Modes
- **File**: `src/safety/permissions.ts`
- **6 modes** (cycle with Shift+Tab in TUI):
  - `default` - Reads only, prompt for everything else
  - `acceptEdits` - Reads + file edits + filesystem commands auto-approved
  - `plan` - Read-only exploration mode
  - `auto` - Everything with background safety classifier
  - `dontAsk` - Only pre-approved tools
  - `bypassPermissions` - Everything (dangerous, container-only)
- **Permission prompt**: Show tool name + params, allow/deny/always-allow
- **Configurable**: Per-tool auto-approve rules in config.toml

### 1.2 Safety Classifier
- **File**: `src/safety/classifier.ts`
- **Trách nhiệm**:
  - Lightweight classifier to evaluate tool calls before execution
  - Block: downloading/executing unknown code, sending data externally, mass deletion, force push
  - Allow: local file operations, dependency installs, read-only HTTP
  - Falls back to prompting after 3 consecutive blocks
- **Implementation**: Rule-based classifier (regex + heuristics), no ML needed

### 1.3 Checkpoint System
- **File**: `src/safety/checkpoints.ts`
- **Trách nhiệm**:
  - Snapshot file contents before any edit/write operation
  - Store in memory (session-scoped, not persisted)
  - Support undo to last checkpoint (Esc+Esc in TUI)
  - List recent checkpoints for selective undo
- **Interface**:
  ```typescript
  interface CheckpointManager {
    snapshot(filePath: string): void
    undo(): UndoResult | null
    listCheckpoints(): Checkpoint[]
  }
  ```

### 1.4 Protected Paths
- Never auto-approved (except bypassPermissions):
  - `.git/`, `.neurocli/`, `.vscode/`, `.husky/`
  - Shell configs (`.bashrc`, `.zshrc`, `.profile`)
  - npm/yarn configs, pre-commit configs
  - `.mcp.json`

## 2. MCP (Model Context Protocol) Support

### 2.1 MCP Client
- **File**: `src/plugins/mcp-client.ts`
- **Trách nhiệm**:
  - Connect to MCP servers via stdio transport
  - Discover tools, resources, prompts from MCP servers
  - Lazy-load tool schemas (only when tool is invoked)
  - Forward MCP tool calls and return results
- **Configuration** in `~/.neurocli/config.toml`:
  ```toml
  [mcp.servers.my-server]
  command = "node"
  args = ["path/to/server.js"]
  env = { API_KEY = "..." }
  ```

### 2.2 MCP Tool Integration
- **File**: `src/plugins/mcp-tools.ts`
- MCP tools integrate with ToolRegistry (Phase 1)
- Tool names namespaced: `mcp__server_name__tool_name`
- Schema loading deferred until first use

### 2.3 MCP Lifecycle
- Start MCP servers at session start
- Ping/health-check periodically
- Graceful shutdown at session end
- Restart on failure (max 3 retries)

## 3. Skills System

### 3.1 Skill Loader
- **File**: `src/plugins/skill-loader.ts`
- **Trách nhiệm**:
  - Load skill markdown files from `~/.neurocli/skills/` and `.neuro/skills/`
  - Parse frontmatter: name, description, trigger, context mode
  - Load descriptions at session start (low context cost)
  - Load full content on demand (when skill is invoked)
- **Skill format**:
  ```markdown
  ---
  name: deploy
  description: Deploy the current project
  trigger: user-invocable
  context: inline | fork
  ---
  # Deploy Skill
  Instructions for deploying...
  ```

### 3.2 Skill Types
- **User-invocable**: Triggered by `/skill-name` command
- **Model-invocable**: Auto-loaded when relevant (based on description matching)
- **Namespaced**: Plugin skills as `/plugin-name:skill-name`

### 3.3 Built-in Skills
- Create starter skills for common workflows:
  - `/init` - Create NEURO.md
  - `/review` - Code review current changes
  - `/fix` - Fix a bug
  - `/test` - Run tests

## 4. Lifecycle Hooks

### 4.1 Hook System
- **File**: `src/plugins/hooks.ts`
- **Events**:
  - `PreToolUse` - Before tool execution (can block)
  - `PostToolUse` - After tool execution
  - `SessionStart` - When session begins
  - `SessionEnd` - When session ends
  - `Notification` - When agent sends notification
- **Hook types**:
  - Shell command (run a script)
  - Prompt (inject context)
  - Subagent (run isolated task)
- **Configuration** in config.toml:
  ```toml
  [[hooks.PreToolUse]]
  match = "edit_file"
  command = "npx eslint --fix ${file}"
  ```

### 4.2 Hook Execution
- Hooks run sequentially, PreToolUse can block
- Hook output injected into context (with token budget)
- Error handling: log and continue (don't break flow)

## Files to Create/Modify

### New Files
```
src/safety/permissions.ts
src/safety/classifier.ts
src/safety/checkpoints.ts
src/plugins/mcp-client.ts
src/plugins/mcp-tools.ts
src/plugins/skill-loader.ts
src/plugins/hooks.ts
```

### Files to Modify
```
src/agent/loop.ts           - Integrate permission checks, checkpoints, hooks
src/agent/tool-registry.ts  - Register MCP tools, skill tools
src/cli/tui.tsx              - Permission mode indicator, Shift+Tab cycling
src/storage/config.ts        - Add MCP, skills, hooks config schema
src/storage/paths.ts         - Add skills, MCP paths
```

## Acceptance Criteria

1. **Permission Modes**: All 6 modes work; Shift+Tab cycles in TUI; prompts show tool+params
2. **Safety Classifier**: Blocks dangerous operations in auto mode; allows safe ones
3. **Checkpoints**: File edits are snapshot-able; Esc+Esc undoes last edit
4. **MCP**: Can connect to at least 1 MCP server; tools appear in agent; schemas lazy-load
5. **Skills**: Can create and invoke a custom skill; descriptions load at start
6. **Hooks**: PreToolUse hook can block/modify tool calls; PostToolUse runs after
7. **All existing tests pass** + new tests for all new modules
