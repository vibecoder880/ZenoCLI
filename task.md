# NeuroCLI -- Task Checklist

## Phase 1 -- Foundation
- [ ] Project setup (package.json, tsconfig, ESLint, build scripts)
- [ ] Entry point `src/index.ts` with commander
- [ ] TUI shell with Ink (`src/cli/tui.tsx`)
  - [ ] Header component (model name, provider, token count)
  - [ ] Prompt input component
  - [ ] Message list component
  - [ ] Slash command menu overlay (type `/` to show commands)
  - [ ] UI style rules: no decorative icons, monochrome/minimal output
- [ ] Basic streaming chat (hardcoded OpenAI for now)
- [ ] Docker foundation
  - [ ] `Dockerfile`
  - [ ] `docker-compose.yml`
  - [ ] Persistent mount for `~/.neurocli`

## Phase 2 -- Auth & Providers
- [ ] Auth profiles storage (`~/.neurocli/auth-profiles.json`)
- [ ] Auth profile model inspired by OpenClaw
  - [ ] Support profile types: `oauth`, `api_key`, `token`
  - [ ] Support active profile selection per provider
  - [ ] Support cooldown/failover metadata
- [ ] OAuth login flow (local server + browser redirect + manual paste fallback)
- [ ] API key login flow (interactive prompt)
- [ ] `neuro auth` CLI commands (login, list, switch, remove, status)
  - [ ] `neuro auth login openai --method oauth`
  - [ ] `neuro auth login openai --method api-key`
  - [ ] `neuro auth login google --method oauth`
  - [ ] `neuro auth login google --method api-key`
  - [ ] `neuro auth login anthropic --method api-key`
- [ ] Provider adapters
  - [ ] Base interface (`src/providers/base.ts`)
  - [ ] OpenAI adapter
  - [ ] Anthropic adapter
  - [ ] Google (Gemini) adapter
  - [ ] Auth capability matrix for each provider
- [ ] Model router with aliases + failover

## Phase 3 -- Agent Engine
- [ ] Tool registry (read_file, edit_file, run_command, list_dir, search_code)
- [ ] ReAct execution loop (`src/agent/loop.ts`)
- [ ] Tool calling adapter for each provider
- [ ] Safety confirmation for destructive commands
- [ ] TUI agent status display (spinners, tool action indicators)

## Phase 4 -- Polish & Release
- [ ] Docker polish (`.dockerignore`, image size cleanup, docs)
- [ ] Config system (`~/.neurocli/config.toml`)
- [ ] NEURO.md project context file
- [ ] Session history (SQLite)
- [ ] Cost tracking
- [ ] Documentation (README.md)
- [ ] npm publish setup
