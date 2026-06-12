# Phase 1: Smart Agent Core

**Mục tiêu**: Biến NeuroCli từ basic CLI thành intelligent agentic coding tool với context management, session persistence, enhanced tools, và memory system.

**Duration estimate**: 2-3 weeks
**Status**: ✅ Completed

## 1. Context Management System

### 1.1 Token-Aware Context Window
- **File**: `src/core/context-manager.ts`
- **Trách nhiệm**:
  - Track token usage per request/response cycle
  - Maintain priority queue: system prompt > NEURO.md > memory > recent conversation > tool outputs (oldest first)
  - Auto-evict when approaching context limit (configurable threshold, default 80%)
  - Provide `getContextStats()` for `/context` command
- **Interface**:
  ```typescript
  interface ContextManager {
    addMessage(role: string, content: string, tokens: number): void
    addToolOutput(toolId: string, output: string, tokens: number): void
    compactIfNeeded(): CompactResult
    getStats(): ContextStats
    snapshot(): ContextSnapshot
  }
  ```

### 1.2 Auto-Compaction
- **File**: `src/core/compactor.ts`
- **Trách nhiệm**:
  - Summarize old conversation turns when context fills
  - Preserve: user requests, key code snippets, current task context
  - Evict oldest tool outputs first, then old messages
  - Thrashing protection: stop compacting if context refills immediately after
- **Strategy**: Use the current provider to generate summaries (1 API call)

### 1.3 Session Persistence
- **File**: `src/core/session.ts`
- **Trách nhiệm**:
  - Save session as JSONL at `~/.neurocli/projects/{hash}/session-{id}.jsonl`
  - Resume session with `neuro --continue` (loads last session)
  - Fork session with `neuro --resume` (creates copy, continues independently)
  - Session metadata: working directory, git branch, timestamp, model used
  - Auto-save after each turn
- **Session format**:
  ```jsonl
  {"type":"system","content":"...","tokens":123,"ts":"2026-06-11T10:00:00Z"}
  {"type":"user","content":"...","tokens":45,"ts":"..."}
  {"type":"assistant","content":"...","tokens":234,"ts":"..."}
  {"type":"tool_use","tool":"read_file","input":{},"ts":"..."}
  {"type":"tool_result","output":"...","tokens":89,"ts":"..."}
  ```

## 2. Enhanced Agent Loop

### 2.1 Upgrade ReAct Loop
- **File**: `src/agent/loop.ts` (refactor)
- **Changes**:
  - Inject ContextManager into loop
  - Support tool_use responses from providers (not just JSON text parsing)
  - Handle multi-tool calls in single response
  - Streaming partial results to TUI while working
  - Support mid-turn corrections (queue user messages during execution)
  - Agentic cycle: gather context → take action → verify → adjust
- **Provider-specific tool_use**:
  - Anthropic: native `tool_use` content blocks
  - OpenAI: `function_call` / `tool_calls` in response
  - Google: `functionCall` in parts

### 2.2 Enhanced Tool Registry
- **File**: `src/agent/tool-registry.ts` (new)
- **Trách nhiệm**:
  - Dynamic tool registration (not hardcoded)
  - Lazy-load tool schemas (only when tool is about to be used)
  - Tool categories: filesystem, search, web, execution, orchestration
  - Tool metadata: description, safety level, auto-approvable
- **Interface**:
  ```typescript
  interface ToolDefinition {
    name: string
    description: string
    parameters: JSONSchema
    safety: 'safe' | 'moderate' | 'dangerous'
    category: 'fs' | 'search' | 'web' | 'exec' | 'orchestration'
    execute(params: Record<string, unknown>): Promise<ToolResult>
  }
  interface ToolRegistry {
    register(tool: ToolDefinition): void
    getDefinitions(): ToolDefinition[]
    getSchema(name: string): JSONSchema
    execute(name: string, params: Record<string, unknown>): Promise<ToolResult>
  }
  ```

### 2.3 New Tools (Claude Code Parity)

#### Filesystem Tools (`src/agent/tools/fs.ts`)
- `glob` - Find files by pattern (like `**/*.ts`)
- `grep` - Search file contents with regex (ripgrep-style)
- `read_file` - Enhanced: support line ranges, multiple files
- `write_file` - Already exists
- `edit_file` - Enhanced: support replace_all, line-based editing
- `list_directory` - Already exists

#### Search Tools (`src/agent/tools/search.ts`)
- `web_search` - Search the web (using SerpAPI or similar)
- `web_fetch` - Fetch and parse a URL
- `search_code` - Enhanced with better regex support

#### Orchestration Tools (`src/agent/tools/orchestration.ts`)
- `ask_user` - Ask user a question with options, wait for response
- `spawn_subagent` - Launch isolated subagent (Phase 3, stub for now)

#### Execution Tools (`src/agent/tools/exec.ts`)
- `run_command` - Enhanced: better safety, timeout, background execution

## 3. Memory System

### 3.1 Cross-Session Memory
- **File**: `src/core/memory.ts`
- **Trách nhiệm**:
  - Read/write `~/.neurocli/projects/{hash}/MEMORY.md`
  - Load first 200 lines / 25KB at session start
  - Auto-save learnings based on user corrections
  - Structured format: frontmatter + categorized entries
- **Auto-memory triggers**:
  - User corrects agent's approach → save the correction
  - User expresses preference → save preference
  - Repeated pattern in project → save pattern

### 3.2 Enhanced NEURO.md Loading
- **File**: `src/core/context.ts` (refactor)
- **Changes**:
  - Hierarchical loading: walk from cwd up to root, load all NEURO.md files
  - Subdirectory NEURO.md loads when agent enters that directory
  - Support `~/.neurocli/NEURO.md` (user global)
  - Support `.neuro/rules/*.md` (scoped rules by file pattern)
  - Dedup and merge overlapping instructions

## 4. Enhanced TUI

### 4.1 Streaming Agent Output
- **File**: `src/cli/tui.tsx` (refactor)
- **Changes**:
  - Show tool calls in real-time as agent works
  - Display progress spinner with current action
  - Show compact notifications
  - Mid-turn input: allow user to type corrections while agent works
  - Rich message rendering: code blocks with syntax highlighting

### 4.2 New Slash Commands
- `/context` - Show context window usage
- `/compact [focus]` - Force compaction with optional focus area
- `/memory` - Show/edit auto-memory
- `/resume` - Resume previous session
- `/fork` - Fork current session
- `/model` - Switch model mid-session

## 5. New CLI Commands

### 5.1 Session Commands
- `neuro --continue` - Resume last session
- `neuro --resume [id]` - Resume or fork a specific session

## Files to Create/Modify

### New Files
```
src/core/context-manager.ts
src/core/compactor.ts
src/core/session.ts
src/core/memory.ts
src/agent/tool-registry.ts
src/agent/tools/fs.ts
src/agent/tools/search.ts
src/agent/tools/orchestration.ts
src/agent/tools/exec.ts
```

### Files to Modify
```
src/agent/loop.ts           - Upgrade to context-aware agentic loop
src/agent/tools.ts          - Migrate to tool-registry pattern
src/core/context.ts          - Enhanced NEURO.md hierarchical loading
src/cli/tui.tsx              - Streaming agent output, mid-turn input
src/cli/slash-commands.ts    - New slash commands
src/index.ts                 - Add --continue, --resume flags
src/providers/base.ts        - Add tool_use support to AiProvider interface
src/providers/openai.ts      - Implement native tool_use
src/providers/anthropic.ts   - Implement native tool_use + streaming
src/providers/google.ts      - Implement native tool_use
src/storage/paths.ts         - Add session and memory paths
```

## Acceptance Criteria

1. **Context Management**: Agent can handle long conversations without hitting context limits; auto-compact triggers at 80% and preserves key context
2. **Session Persistence**: `neuro --continue` resumes exact conversation state; `neuro --resume` creates independent fork
3. **Enhanced Tools**: glob, grep (with regex), web_search, web_fetch, ask_user all work in agent loop
4. **Memory System**: MEMORY.md auto-saves corrections/preferences; loads at session start
5. **NEURO.md Hierarchy**: All NEURO.md files from cwd to root load; subdirectory rules apply contextually
6. **TUI**: Shows real-time tool execution, supports mid-turn corrections, rich code rendering
7. **All existing tests pass** + new tests for all new modules
8. **No regression** in existing commands (chat, agent, history, config, etc.)

## Out of Scope (Later Phases)
- MCP server support (Phase 2)
- Skills system (Phase 2)
- Permission modes (Phase 2)
- Subagent spawning (Phase 3)
- Team coordination (Phase 3)
- LSP integration (Phase 4)
