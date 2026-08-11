---
title: "Premium Parity — opencode / claude-code inspired upgrades"
status: planning
created: 2026-08-12
scope: project
phases:
  - phase-01-openai-compatible-provider
  - phase-02-tui-command-palette
  - phase-03-tui-manage-models
  - phase-04-session-fork-ux
---

# Premium Parity — ZenoCLI

## Overview

Elevate ZenoCLI toward opencode/claude-code parity by porting the highest-value,
architecture-fitting features from those projects. Each phase is self-contained;
implement sequentially with commit → push → CI-green per phase.

## Phases

| # | Name | Priority | Depends | Status |
|---|------|----------|---------|--------|
| 1 | OpenAI-compatible provider (75+ providers) | P1 | — | pending |
| 2 | TUI command palette polish | P1 | — | pending |
| 3 | TUI manage-models dialog | P2 | 2 | pending |
| 4 | Session fork UX | P2 | 2 | pending |

## Dependencies

- Phase 3 (manage models) builds on Phase 2 (palette) for dialog conventions.
- Phase 4 (fork UX) reuses existing `forkSession` core; adds a TUI picker.

## Acceptance Criteria (global)

- Each phase committed in English, pushed, CI green (windows + ubuntu).
- No breaking changes to existing CLI/TUI public contracts.
- No new heavy dependencies.

## Phase Files

- [Phase 1: OpenAI-compatible provider](./phase-01-openai-compatible-provider.md)
- [Phase 2: TUI command palette](./phase-02-tui-command-palette.md)
- [Phase 3: TUI manage models](./phase-03-tui-manage-models.md)
- [Phase 4: Session fork UX](./phase-04-session-fork-ux.md)
