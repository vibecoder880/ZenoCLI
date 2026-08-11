---
phase: 1
title: "OpenAI-compatible provider"
status: pending
priority: P1
dependencies: []
---

# Phase 1: OpenAI-compatible provider (75+ providers)

## Overview
Port opencode's `openai-compatible` adapter pattern so ZenoCLI can talk to any
OpenAI-compatible endpoint (OpenRouter, xAI, Azure, Groq, local Ollama, etc.)
via one generic provider, unlocking 75+ providers from config — no code changes
per provider.

## Requirements
- Functional: a `provider` of type `openai-compatible` in `config.toml` with a
  `baseURL` + optional `apiKey`/`apiKeyEnv` can be used for `zeno chat`/`agent`.
- Functional: `config.providers.<name>` entries with `type: "openai-compatible"`
  and `baseURL` are creatable via `createProvider`.
- Functional: works alongside the existing openai/anthropic/google adapters.
- Non-functional: no new dependency (uses the existing OpenAI SDK client with a
  custom baseURL).

## Architecture
`createProvider()` currently switches on slug. Add a case that resolves config
providers of type `openai-compatible` to an `OpenAiCompatibleProvider`:
- reads `baseURL`, `apiKey` (or `apiKeyEnv` env var)
- uses the existing OpenAI SDK (`new OpenAI({ baseURL, apiKey })`) — the SDK
  already speaks the OpenAI wire format which compatible providers share.
- `chat()` streams via `chat.completions.create` (same as OpenAiProvider but
  with a configurable baseURL and no hardcoded model list).

## Related Code Files
- Modify: `src/providers/index.ts` — resolve config providers of type
  `openai-compatible`; pass baseURL/env to a new adapter
- Modify: `src/storage/config.ts` — extend `[providers]` entry type with
  `type`, `baseURL`, `apiKeyEnv`
- Create: `src/providers/openai-compatible.ts` (adapter mirroring OpenAiProvider
  with configurable baseURL + model passthrough)
- Create: `src/providers/openai-compatible.test.ts` (mock fetch, verify baseURL)

## Implementation Steps
1. Extend config `providers` entry type with optional `type`/`baseURL`/`apiKeyEnv`.
2. Implement `OpenAiCompatibleProvider` (clone OpenAiProvider, parameterize baseURL,
   model from route, no hardcoded listModels — return `[model]`).
3. In `createProvider`, when the slug matches a config provider of type
   `openai-compatible`, construct it from config.
4. Add `listModelCatalog` support so `zeno models` shows compatible providers.
5. Test: config with openai-compatible provider → createProvider returns it;
   chat uses the custom baseURL (mock fetch).

## Success Criteria
- [ ] `config.toml` `[providers.openrouter] type="openai-compatible" baseURL="https://openrouter.ai/api/v1" apiKeyEnv="OPENROUTER_API_KEY"` makes `zeno chat --provider openrouter` work
- [ ] Existing 3 providers unchanged
- [ ] ESLint clean, CI green

## Risk Assessment
- The OpenAI SDK must accept custom baseURL — it does (v4+ `baseURL` option).
- Some compatible endpoints differ on tool-calling; non-tool chat must work first.
