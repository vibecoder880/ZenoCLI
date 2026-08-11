---
title: "Remaining Roadmap Gaps"
status: planning
created: 2026-08-12
scope: project
phases:
  - phase-01-headless-chat
  - phase-02-code-review-command
  - phase-03-tui-diff-viewer
  - phase-04-device-code-flow
  - phase-05-multi-model-lightweight
  - phase-06-docs-finalize
---

# Remaining Roadmap Gaps — ZenoCLI

## Overview

Close the six verified gaps from the competitive-analysis roadmap that are still
open after the auth/security/super-kit slices. Each is a self-contained phase;
implement sequentially per the user's "xong làm lần lượt".

## Phases

| # | Name | Priority | Depends | Status |
|---|------|----------|---------|--------|
| 1 | Headless chat (`--non-interactive`/`--pipe`) | P1 | — | pending |
| 2 | Code review command (`zeno review`) | P1 | 1 | pending |
| 3 | TUI diff viewer | P1 | — | pending |
| 4 | Device Code Flow (OAuth) | P1 | — | pending |
| 5 | Lightweight model for metadata | P1 | — | pending |
| 6 | Docs finalize | P2 | 1-5 | pending |

## Dependencies

- Phase 2 (code review) reuses Phase 1's headless plumbing for non-interactive review output.
- Phase 6 (docs) depends on all others so docs reflect final behavior.

## Acceptance Criteria (global)

- Each phase: code committed in English, pushed to `khanh`, CI green (windows + ubuntu).
- No breaking changes to existing public contracts (CLI flags, provider API, TUI).
- No new dependencies unless required; ESM Node 22, TS strict, ESLint clean.

## Phase Files

- [Phase 1: Headless chat](./phase-01-headless-chat.md)
- [Phase 2: Code review command](./phase-02-code-review-command.md)
- [Phase 3: TUI diff viewer](./phase-03-tui-diff-viewer.md)
- [Phase 4: Device Code Flow](./phase-04-device-code-flow.md)
- [Phase 5: Lightweight model](./phase-05-multi-model-lightweight.md)
- [Phase 6: Docs finalize](./phase-06-docs-finalize.md)
