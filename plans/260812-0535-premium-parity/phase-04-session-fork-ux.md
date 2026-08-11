---
phase: 4
title: "Session fork UX"
status: pending
priority: P2
dependencies: [2]
---

# Phase 4: Session fork UX

## Overview
Expose the existing `forkSession()` core as a polished TUI flow (opencode's fork
dialog): `/fork` lets the user pick a message to fork from, then starts a new
session from that point. Currently `forkSession` exists in core but has no
interactive UX.

## Requirements
- Functional: `/fork` opens a picker of recent messages (or a prompt to enter a
  message index); choosing one forks the session at that point.
- Functional: after forking, the TUI switches to the new session and continues
  with the fork as the starting context.
- Non-functional: reuses `forkSession` from `src/core/session.ts`; Ink-only.

## Architecture
Add a `ForkDialog` component. On `/fork`:
- list the current session's messages (text preview + index) via the session
  reader
- ↑/↓ select, Enter forks via `forkSession(sessionId, cwd)`, Esc cancels
- on success, reset the TUI message list to the fork and set the active session
  to the new writer

## Related Code Files
- Create: `src/cli/components/ForkDialog.tsx`
- Modify: `src/cli/tui.tsx` — handle `/fork` to open ForkDialog and swap session
- Create: `src/cli/components/ForkDialog.test.tsx`
- Verify: `src/core/session.ts` `forkSession` signature/behavior

## Implementation Steps
1. Read `forkSession` to confirm behavior + return.
2. Build ForkDialog listing messages; Enter → fork; swap TUI session state.
3. Wire `/fork` in TUI.
4. Test with ink-testing-library (renders messages, fork call).

## Success Criteria
- [ ] `/fork` lists session messages and forks from a selection
- [ ] TUI switches to the forked session and continues
- [ ] Esc cancels cleanly
- [ ] ESLint clean, CI green

## Risk Assessment
- `forkSession` may expect a specific shape; verify before wiring.
- Swapping session state must not corrupt the current writer.
