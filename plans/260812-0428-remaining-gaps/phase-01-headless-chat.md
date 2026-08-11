---
phase: 1
title: "Headless chat"
status: pending
priority: P1
dependencies: []
---

# Phase 1: Headless chat

## Overview
Add `--non-interactive` / `--pipe` to `zeno chat` (mirroring `zeno agent`),
producing plain machine-readable stdout for CI/CD scripting with no TTY
decorations. Default interactive behavior unchanged.

## Requirements
- Functional: `zeno chat "prompt" --non-interactive` prints only the response
  text; `--pipe` is an alias. Errors go to stderr with `[chat]` prefix.
- Functional: exit code 0 on success; non-zero on abort/provider error.
- Non-functional: backward compatible — no `--non-interactive` → current output.
- No TTY decorations, no history-tracking banner.

## Architecture
`runChatCommand` already streams via `collectProviderText` with an `onText`
callback. Add a `nonInteractive` option: when set, suppress the trailing newline
decorations and route errors to stderr. Reuse the SIGINT→abort controller from
`agent.ts` (extract shared helper) so Ctrl+C cancels the stream.

## Related Code Files
- Modify: `src/cli/commands/chat.ts` (add nonInteractive option + output mode)
- Modify: `src/index.ts` (add `--non-interactive`, `--pipe` to chat command)
- Create: `src/cli/commands/chat-headless.test.ts` (or extend existing)
- Refactor: extract `installSigintAbort()` from `agent.ts` to a shared util

## Implementation Steps
1. Add `nonInteractive?: boolean` to `RunChatOptions`.
2. In `runChatCommand`, when nonInteractive: print only streamed text (no
   trailing blank line), errors to stderr, install SIGINT→abort.
3. Wire `--non-interactive` / `--pipe` flags in `src/index.ts` chat command.
4. Extract shared `installSigintAbort()` to `src/cli/sigint.ts`; use in chat + agent.
5. Test: headless prints plain text, exit 0; non-headless unchanged.

## Success Criteria
- [ ] `zeno chat "hi" --non-interactive` → only response text to stdout
- [ ] Interactive output identical to before
- [ ] ESLint clean, CI green

## Risk Assessment
- Refactor of `installSigintAbort` touches agent.ts — keep behavior identical.
- Low risk; additive flags.
