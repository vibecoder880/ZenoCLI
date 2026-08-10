# Feature Journal — Headless mode + Abort + Retry

**Date:** 2026-08-11 · **Branch:** `khanh` · **Status:** DONE, CI green (windows + ubuntu)

## What & why

Roadmap slice from the competitive analysis (vs Claude Code `-p`, Codex `--non-interactive`).
Three P1 gaps closed in one batch:

1. **Abort support** — cancel an in-flight provider stream and stop the agent loop cleanly.
2. **Bounded retry** — retry retryable provider errors with exponential backoff.
3. **Headless mode** — `zeno agent --non-interactive / --pipe` for CI/CD.

## Implementation

| File | Change |
|------|--------|
| `src/providers/base.ts` | `ChatRequest.signal?: AbortSignal` |
| `src/providers/openai.ts` / `anthropic.ts` / `google.ts` | Pass `request.signal` into SDK calls (OpenAI `create(…,{signal})`, Anthropic `stream(…,{signal})`, Google `fetch(…,{signal})`) |
| `src/core/stream.ts` | `collectProviderText(…, signal?)` — races mid-stream abort against next chunk; throws on pre-aborted signal; clean listener cleanup |
| `src/agent/loop.ts` | Checks signal before each turn, mid-batch, and in catch; returns `aborted: true`; `callWithRetry()` bounded exponential backoff; forwards signal into `executeTool()` context |
| `src/cli/commands/agent.ts` | `nonInteractive` output path; SIGINT→abort controller; exit code 130 on abort |
| `src/index.ts` | `--non-interactive`, `--pipe`, `--retries <n>` flags |

## Tests (9 new, all pass locally + CI)

- `src/core/stream.test.ts` — pre-aborted throw, mid-stream abort, chunk+usage accumulation
- `src/agent/loop.test.ts` — retry→success (3 calls), capped retries, abort clean-stop
- `src/cli/commands/agent.test.ts` — headless plain output, exit 130, interactive default preserved

## CI verification

- Commit `a242dfb` → CI failed: `tsc` strict rejected `(reason: Error) => void` cast to
  `EventListener` (local eslint missed it — it's a type-level-only error).
- Commit `c74674c` → fixed by typing `onAbort` as `() => void` (genuine `EventListener`).
- Final: `gh run watch 31434529858` → **all green** (windows-latest + ubuntu-latest, verify step = test + lint + build).

## Out of scope (next slices)

- Abort/retry not wired into `src/agent/subagent.ts` (self-contained loop, separate concern).
- No `--timeout` flag for agent (only SIGINT-based cancellation).
- Headless mode only for `agent`; `chat`/TUI unchanged.

## Files changed (commits `a242dfb`, `c74674c`)

```
src/providers/base.ts  src/providers/{openai,anthropic,google}.ts
src/core/stream.ts     src/core/stream.test.ts
src/agent/loop.ts      src/agent/loop.test.ts
src/cli/commands/agent.ts   src/cli/commands/agent.test.ts
src/index.ts
```

## Docs updated (this finalize pass, uncommitted)

- `README.md` — headless/`--pipe`/`--retries` usage; fixed stale `v0.2.0` → `v0.7.1` in TUI
  ASCII + release section (added macOS to build matrix).
- `docs/architecture.md` — provider `signal` contract, agent-flow abort/retry, headless note.

## Unresolved

- None blocking. (Docs changes + pre-existing README/docs edits still need a commit + CI pass.)
