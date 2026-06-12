# Phase 3: Multi-Agent System

**Mục tiêu**: Subagent spawning với context isolation, team coordination, task management, và parallel execution.

**Duration estimate**: 2-3 weeks
**Status**: ✅ Completed

## 1. Subagent System

### 1.1 Subagent Spawner
- **File**: `src/agent/subagent.ts`
- **Trách nhiệm**:
  - Spawn isolated agent with fresh context window
  - Pass task prompt and available tools
  - Return summary (not full conversation) to parent
  - Support worktree isolation (git worktree per subagent)
  - Timeout and resource limits
- **Interface**:
  ```typescript
  interface SubagentSpawner {
    spawn(prompt: string, opts: SubagentOptions): Promise<SubagentResult>
  }
  interface SubagentOptions {
    tools?: string[]          // Available tools
    skills?: string[]         // Preloaded skills
    isolation?: 'none' | 'worktree'
    timeout?: number          // Max execution time
    model?: string            // Override model
    schema?: object           // Structured output schema
  }
  interface SubagentResult {
    output: string | object   // Text or structured result
    tokensUsed: number
    filesChanged: string[]
    success: boolean
    error?: string
  }
  ```

### 1.2 Context Isolation
- Subagent gets fresh context window (no parent conversation)
- Only receives: task prompt, tool definitions, relevant file contents
- Returns: summary + structured data (not full conversation)
- Prevents main context bloat

### 1.3 Concurrent Execution
- Max concurrent subagents: `min(16, cpu_cores - 2)`
- Queue excess spawns
- Total subagent count per session capped at 1000
- Progress tracking for parallel operations

## 2. Team Coordination

### 2.1 Team Manager
- **File**: `src/agent/team.ts`
- **Trách nhiệm**:
  - Create/destroy teams
  - Register teammates with roles and capabilities
  - Coordinate task assignment
  - Manage shared state
- **Team config**: `~/.neurocli/teams/{team-name}/config.json`
  ```json
  {
    "name": "my-project",
    "description": "...",
    "members": [
      { "name": "lead", "agentId": "...", "agentType": "coordinator" },
      { "name": "researcher", "agentId": "...", "agentType": "researcher" },
      { "name": "coder", "agentId": "...", "agentType": "coder" }
    ]
  }
  ```

### 2.2 Task List
- **File**: `src/agent/task-list.ts`
- **Shared task file**: `~/.neurocli/tasks/{team-name}/tasks.jsonl`
- **Task model**:
  ```typescript
  interface Task {
    id: string
    subject: string
    description: string
    status: 'pending' | 'in_progress' | 'completed' | 'deleted'
    owner?: string
    blocks?: string[]      // Task IDs this blocks
    blockedBy?: string[]   // Task IDs blocking this
    createdAt: string
    updatedAt: string
  }
  ```
- **File-based coordination**: Append-only JSONL with file locking
- **Task dependencies**: blockedBy/blocks relationships
- **Claiming**: First-come via file lock

### 2.3 Messaging System
- **File**: `src/agent/messaging.ts`
- **Mailbox model**: Each teammate has a mailbox
- **Message types**:
  - Plain text (coordination, status)
  - Plan approval request/response
  - Shutdown request/response
- **Delivery**: Automatic, no polling needed
- **Messages stored in**: `~/.neurocli/teams/{team-name}/messages/`

### 2.4 Team Lifecycle
1. Lead creates team → creates task list
2. Lead creates tasks → assigns to teammates
3. Teammates claim tasks → execute → report
4. Lead coordinates via messages
5. Lead shuts down team when done

## 3. Agent Definitions

### 3.1 Custom Agent Types
- **File**: `src/agents/` (new directory)
- **Purpose**: Define reusable agent roles
- **Format**: `.neuro/agents/{name}.md`
  ```markdown
  ---
  name: code-reviewer
  description: Reviews code for bugs and quality issues
  tools: [read_file, glob, grep]
  model: anthropic/claude-sonnet-4-0
  ---
  # Code Reviewer Agent
  You review code changes...
  ```
- Agents can be used as teammates OR as standalone subagents

### 3.2 Built-in Agent Types
- `researcher` - Read-only exploration and analysis
- `coder` - Implementation with file editing
- `reviewer` - Code review
- `tester` - Test writing and execution
- `coordinator` - Team lead, task management

## 4. Plan Approval Workflow

### 4.1 Plan Mode
- **File**: `src/agent/plan-mode.ts`
- Agent proposes implementation plan
- User reviews with options:
  - Approve and implement (switches to acceptEdits)
  - Modify plan
  - Reject and re-plan
- Plan stored as structured data (not just text)
- Plan can be saved for later execution

### 4.2 Plan-as-Code
- Plans stored in `.neuro/plans/` as markdown
- Executable: `neuro plan execute {plan-file}`
- Trackable: tasks linked to plan steps

## Files to Create

```
src/agent/subagent.ts
src/agent/team.ts
src/agent/task-list.ts
src/agent/messaging.ts
src/agent/plan-mode.ts
src/agents/                      # Agent definitions directory
src/agents/researcher.md
src/agents/coder.md
src/agents/reviewer.md
src/agents/tester.md
src/agents/coordinator.md
```

## Files to Modify
```
src/agent/loop.ts           - Support subagent spawning
src/agent/tool-registry.ts - Add subagent/team tools
src/cli/tui.tsx              - Team display, task progress
src/index.ts                 - Team management commands
src/storage/paths.ts         - Team/task paths
```

## Acceptance Criteria

1. **Subagents**: Can spawn isolated agents; they return summaries; context stays clean
2. **Concurrent**: Multiple subagents run in parallel without file conflicts (worktrees)
3. **Teams**: Can create team, assign tasks, teammates communicate
4. **Task List**: File-based coordination works; blocking/dependencies resolve
5. **Plan Mode**: Agent proposes plan; user approves/modifies/rejects
6. **Agent Definitions**: Can define custom agent types; they load correctly
7. **All existing tests pass** + new tests for all new modules
