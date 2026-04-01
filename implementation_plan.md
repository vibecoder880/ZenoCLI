# NeuroCLI -- Implementation Plan

## Overview

Build a professional, multi-AI terminal coding agent. The tool combines the clean minimalist UI of Gemini CLI with the deep agentic coding power of Claude Code, supporting multiple AI providers through both OAuth login and API keys (inspired by OpenClaw's auth system). Packaged with Docker for portability.

**Design principles:**
- Clean, professional -- no decorative icons, no clutter
- Fast startup, minimal dependencies
- Multi-provider from day one

**Stack:** Node.js + TypeScript + Ink (React for CLI)

---

## Proposed Changes

### Authentication System

Inspired by OpenClaw's auth profile system: secrets stored locally, multiple credentials per provider, OAuth + API key where the provider supports it, with profile rotation and failover.

#### [NEW] [auth-profiles.ts](file:///d:/VibeCoder/NeuroCli/src/auth/auth-profiles.ts)

Central auth storage manager. Auth profiles stored in `~/.neurocli/auth-profiles.json`:

```typescript
// Profile types
type AuthProfile =
  | { type: "api_key"; provider: string; key: string; label?: string }
  | { type: "oauth"; provider: string; access: string; refresh: string; expires: number; email?: string }
  | { type: "token"; provider: string; token: string; expires?: number; label?: string };

// Storage: ~/.neurocli/auth-profiles.json
// Profile IDs: "provider:default" or "provider:user@email.com"
```

Features:
- Save/load/delete profiles
- Active profile selection per provider
- Profile rotation (OAuth preferred over API keys when both are available)
- Cooldown tracking on rate-limit or auth failure
- Auto-fallback to next available profile
- Refresh OAuth credentials when the provider supports refresh tokens

#### Auth Capability Matrix

For the first NeuroCLI release, support only these providers:

| Provider | API Key | OAuth | Notes |
|---|---|---|---|
| OpenAI | Yes | Yes | Follow the OpenClaw-style account login pattern |
| Google | Yes | Yes | OAuth and API key should both be first-class |
| Anthropic | Yes | No browser OAuth in v1 | Keep Anthropic on API key first |

#### [NEW] [oauth-server.ts](file:///d:/VibeCoder/NeuroCli/src/auth/oauth-server.ts)

Temporary local HTTP server for OAuth callback:
- Start on `localhost:9876`
- Open browser to provider auth URL
- Receive callback with auth code
- Exchange for tokens, store in auth-profiles
- Headless fallback: print URL, user pastes redirect

Supported OAuth providers in v1: **OpenAI, Google**

#### [NEW] [auth.ts (command)](file:///d:/VibeCoder/NeuroCli/src/cli/commands/auth.ts)

CLI commands:
```
neuro auth login <provider> --method oauth
neuro auth login <provider> --method api-key
neuro auth list                # Show all connected profiles
neuro auth switch <provider>   # Change active provider
neuro auth remove <provider>   # Disconnect
neuro auth status              # Connection health + token validity
```

Behavior should follow OpenClaw-style profile management:
- Allow multiple profiles for the same provider
- Allow choosing which profile is active
- Prefer reusing stored credentials over asking again
- Keep auth storage stable across restarts and Docker runs

---

### Provider Adapters

#### [NEW] [base.ts](file:///d:/VibeCoder/NeuroCli/src/providers/base.ts)

Unified provider interface with standardized tool calling adapter:

```typescript
interface AiProvider {
  name: string;
  slug: string;
  authMethods: ("oauth" | "api_key" | "local")[];
  
  chat(request: ChatRequest): AsyncIterable<StreamEvent>;
  listModels(): Promise<ModelInfo[]>;
  healthCheck(): Promise<ProviderStatus>;
}

// StreamEvent discriminated union:
// { type: "text", content: string }
// { type: "tool_call", id: string, name: string, args: object }
// { type: "done", usage: TokenUsage }
```

#### [NEW] Provider implementations

| File | Provider | Auth |
|---|---|---|
| [openai.ts](file:///d:/VibeCoder/NeuroCli/src/providers/openai.ts) | OpenAI | OAuth / API Key |
| [anthropic.ts](file:///d:/VibeCoder/NeuroCli/src/providers/anthropic.ts) | Anthropic | API Key |
| [google.ts](file:///d:/VibeCoder/NeuroCli/src/providers/google.ts) | Google Gemini | OAuth / API Key |

#### [NEW] [router.ts](file:///d:/VibeCoder/NeuroCli/src/providers/router.ts)

Model router with failover:
- `neuro --model auto` -- smart routing based on task
- `neuro --model gpt-4o` -- direct selection
- Aliases: `fast` -> groq/llama, `smart` -> claude-4-sonnet, `cheap` -> ollama/local
- Auto-fallback on provider error

---

### Agent Engine (Claude Code-style)

#### [NEW] [tools.ts](file:///d:/VibeCoder/NeuroCli/src/agent/tools.ts)

Tool registry -- functions the AI can call autonomously:

| Tool | Purpose |
|---|---|
| `read_file(path)` | Read source code |
| `write_file(path, content)` | Create new files |
| `edit_file(path, search, replace)` | Modify existing code |
| `run_command(cmd)` | Execute shell commands |
| `list_dir(path)` | Browse file system |
| `search_code(query, path?)` | Grep/ripgrep search |

Safety: destructive commands (`rm`, `git push`) require user confirmation.

#### [NEW] [loop.ts](file:///d:/VibeCoder/NeuroCli/src/agent/loop.ts)

ReAct execution loop:
1. Send messages + tool schemas to model
2. If model returns `tool_calls` -> execute locally
3. Append `tool_result` to history
4. Re-send to model (loop until model stops calling tools)
5. Stream final answer to TUI

---

### TUI (Terminal User Interface)

#### [NEW] [tui.tsx](file:///d:/VibeCoder/NeuroCli/src/cli/tui.tsx)

Built with Ink (React for CLI). Clean, professional layout:

```
  NeuroCLI v1.0
  Model: claude-4-sonnet | Provider: anthropic | Tokens: 1.2k

  > fix the authentication bug in auth.ts

  -- Agent -------------------------------------------
  | > Reading src/auth.ts                             |
  | > Found issue at line 42                          |
  | > Editing src/auth.ts                             |
  | > Running npm test                                |
  | + All tests passed                                |
  ----------------------------------------------------

  Fixed null check in validateToken().

  > _
```

Design rules:
- No decorative icons anywhere
- Monochrome with subtle chalk coloring (dim, bold, cyan for highlights)
- Compact, no wasted vertical space
- Agent actions shown with simple prefix characters (`>`, `+`, `!`)

#### [NEW] Slash Command Menu

When user types `/`, display an autocomplete overlay:

```
  > /
  +---------------------------------+
  | /help        Show all commands  |
  | /model       Switch AI model    |
  | /auth        Manage providers   |
  | /clear       Clear conversation |
  | /cost        Show token usage   |
  | /context     Set file context   |
  | /compact     Summarize history  |
  | /exit        Quit NeuroCLI      |
  +---------------------------------+
```

Arrow keys to navigate, Tab/Enter to select, Esc to dismiss.

---

### Configuration

#### [NEW] [config.ts](file:///d:/VibeCoder/NeuroCli/src/storage/config.ts)

Config at `~/.neurocli/config.toml`:

```toml
[default]
model = "anthropic/claude-4-sonnet"
streaming = true

[aliases]
fast = "groq/llama-3.3-70b"
smart = "anthropic/claude-4-sonnet"
cheap = "ollama/qwen2.5-coder"

[context]
max_tokens = 100000
ignore = ["node_modules", ".git", "dist"]
```

Project-level context: `NEURO.md` in project root (custom instructions per project, similar to Gemini CLI's `GEMINI.md`).

---

### Docker Support

#### [NEW] [Dockerfile](file:///d:/VibeCoder/NeuroCli/Dockerfile)

Multi-stage build:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json .
ENTRYPOINT ["node", "dist/index.js"]
```

#### [NEW] [docker-compose.yml](file:///d:/VibeCoder/NeuroCli/docker-compose.yml)

```yaml
services:
  neurocli:
    build: .
    stdin_open: true
    tty: true
    volumes:
      - ~/.neurocli:/root/.neurocli    # persist auth profiles + config
      - .:/workspace                   # mount project
    working_dir: /workspace
```

Docker requirement:
- The auth profile store must survive container recreation.
- A user should be able to move the project to another machine, mount `~/.neurocli`, and keep setup simple.

#### [NEW] [.dockerignore](file:///d:/VibeCoder/NeuroCli/.dockerignore)

Standard ignores: `node_modules`, `.git`, `dist`, etc.

---

### Project Foundation

#### [NEW] [package.json](file:///d:/VibeCoder/NeuroCli/package.json)

Key dependencies:
- `ink` + `react` -- TUI framework
- `commander` -- CLI argument parsing
- `chalk` -- terminal colors
- `openai` -- OpenAI SDK
- `@anthropic-ai/sdk` -- Anthropic SDK
- `@google/generative-ai` -- Gemini SDK
- `conf` -- config management (TOML)
- `better-sqlite3` -- session history
- `open` -- browser launch for OAuth
- `eventsource-parser` -- SSE stream parsing

#### [NEW] [tsconfig.json](file:///d:/VibeCoder/NeuroCli/tsconfig.json)

TypeScript strict mode, ESM output, JSX for Ink.

#### [NEW] [index.ts](file:///d:/VibeCoder/NeuroCli/src/index.ts)

Entry point: parse CLI args -> route to command or interactive TUI.

---

## Project Structure

```
NeuroCli/
  package.json
  tsconfig.json
  Dockerfile
  docker-compose.yml
  .dockerignore
  src/
    index.ts                    # Entry point
    cli/
      tui.tsx                   # Main TUI (Ink)
      components/
        Prompt.tsx              # Input box
        SlashMenu.tsx           # Slash command overlay
        AgentStatus.tsx         # Agent action display
        Header.tsx              # Top bar (model, tokens)
        MessageList.tsx         # Chat messages
      commands/
        auth.ts                 # Auth management
        chat.ts                 # Interactive chat
    auth/
      auth-profiles.ts          # Profile storage (OpenClaw-style)
      oauth-server.ts           # Local OAuth callback server
    providers/
      base.ts                   # Provider interface
      openai.ts
      anthropic.ts
      google.ts
      router.ts                 # Model selection + failover
    agent/
      tools.ts                  # Tool registry
      loop.ts                   # ReAct execution loop
    storage/
      config.ts                 # Config management
      history.ts                # Session history (SQLite)
    core/
      context.ts                # File context loader
      stream.ts                 # Stream utilities
```

---

## Verification Plan

### Automated Tests

Since this is a new project, we will add tests incrementally:

```bash
# Run all tests
npm test

# Type checking
npx tsc --noEmit
```

Phase 1 verification (after initial build):

```bash
# 1. Build succeeds
npm run build

# 2. CLI starts without error
node dist/index.js --help

# 3. Docker builds
docker build -t neurocli .
```

### Manual Verification

After Phase 1 build, verify interactively:

1. **CLI startup**: Run `npx tsx src/index.ts` -- should show header with "NeuroCLI" and prompt
2. **Slash menu**: Type `/` in prompt -- should show command list overlay
3. **Auth flow**: Run `neuro auth login openai` -- should support OAuth or API key and save
4. **Auth flow**: Run `neuro auth login google` -- should support OAuth or API key and save
5. **Auth flow**: Run `neuro auth login anthropic --method api-key` -- should save and validate key
6. **Chat**: Type a message -- should stream response from configured model
7. **Docker**: Run `docker compose run neurocli` -- should start interactive TUI and reuse saved auth/config

> [!IMPORTANT]
> Phase 1 target: Foundation + OpenAI/Google/Anthropic provider shells, OpenAI and Google auth flows, Anthropic API key flow, basic TUI with slash commands, and Docker portability. Agent engine depth and model routing sophistication come after that.
