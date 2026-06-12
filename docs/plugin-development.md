# NeuroCli — Plugin Development Guide

Hướng dẫn tạo plugins/skills/MCP servers cho NeuroCli.

## Built-in Skills

Skills là markdown files với frontmatter, loaded từ:
- `~/.neurocli/skills/` (global)
- `.neuro/skills/` (project)
- `src/plugins/builtin/` (built-in)

### Tạo một Skill

Tạo file `~/.neurocli/skills/deploy.md`:

```markdown
---
name: deploy
description: Deploy the project to production
trigger: user-invocable
context: inline
---

# Deploy Skill

You are deploying the project. When invoked:

1. Check git status (must be clean)
2. Run tests
3. Build the project
4. Deploy to production
5. Verify deployment

Use `run_command` to execute shell commands.
```

Trigger skill với `/deploy` trong TUI.

## MCP Server Integration

Model Context Protocol (MCP) cho phép NeuroCli kết nối với external tools.

### Config

Trong `~/.neurocli/config.toml`:
```toml
[mcp.servers.my-server]
command = "node"
args = ["path/to/server.js"]
env = { API_KEY = "..." }
```

### Tạo MCP Server

MCP server giao tiếp qua stdio theo JSON-RPC protocol. Xem [MCP spec](https://modelcontextprotocol.io).

Minimal example (Node.js):
```javascript
#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server({
  name: "my-server",
  version: "1.0.0",
}, {
  capabilities: { tools: {} }
});

server.setRequestHandler("tools/list", async () => ({
  tools: [{
    name: "my_tool",
    description: "Does something",
    inputSchema: { type: "object", properties: { ... } }
  }]
}));

server.setRequestHandler("tools/call", async (request) => ({
  content: [{ type: "text", text: "Result" }]
}));

const transport = new StdioServerTransport();
await server.connect(transport);
```

Tools từ MCP server tự động xuất hiện với namespace `mcp__server-name__tool-name`.

## Custom Agent Types

Tạo custom agent roles cho subagent spawning.

### File location
- `~/.neurocli/agents/` (global)
- `.neuro/agents/` (project)

### Format
```markdown
---
name: security-auditor
description: Audits code for security issues
tools: [read_file, grep, glob]
model: anthropic/claude-sonnet-4-0
---

# Security Auditor Agent

You are a security specialist. Your job is to:

1. Scan for common vulnerabilities
2. Check authentication flows
3. Validate input handling
4. Review sensitive data exposure
```

Sử dụng với `spawnTypedSubagent` hoặc coordinator agent.

## Lifecycle Hooks

Hooks cho phép custom validation trước/sau tool calls.

### Config
```toml
[[hooks.PreToolUse]]
match = "edit_file"
command = "npx eslint --fix ${file}"

[[hooks.PostToolUse]]
match = "write_file"
command = "echo 'File written: ${file}'"
```

### Available Events
- `PreToolUse` — Before tool execution
- `PostToolUse` — After tool execution
- `SessionStart` — When session begins
- `SessionEnd` — When session ends
- `Notification` — Agent notifications

### Template Variables
- `${file}` — File path (from params.path)
- `${tool}` — Tool name
- `${cwd}` — Working directory
- `${result}` — Tool result (PostToolUse only)

## Permission Modes

Cycle modes với Shift+Tab trong TUI hoặc `/permission` command.

| Mode | Behavior |
|------|----------|
| `default` | Prompt for writes |
| `acceptEdits` | Auto-approve file edits |
| `plan` | Read-only |
| `auto` | Safety classifier decides |
| `dontAsk` | Only pre-approved tools |
| `bypassPermissions` | Everything allowed |

## Examples

Xem `src/plugins/builtin/` cho built-in skill examples.
