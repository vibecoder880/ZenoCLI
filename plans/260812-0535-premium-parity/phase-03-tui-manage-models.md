---
phase: 3
title: "TUI manage models dialog"
status: pending
priority: P2
dependencies: [2]
---

# Phase 3: TUI manage models dialog

## Overview
Add a `/models`-driven dialog (opencode's `DialogManageModels`) where users can
see the active model, list the model registry (tiers), and switch the active
model or alias without leaving the TUI. Complements Phase 2 palette conventions.

## Requirements
- Functional: `/models` opens a picker listing registry models grouped by tier
  (premium/standard/economy) with quality/cost hints.
- Functional: ↑/↓ navigate, Enter selects → updates `config.default.model` /
  alias `fast`, Esc closes.
- Functional: shows the currently active model with a marker.
- Non-functional: Ink-only; reuses `ModelRegistry` + `config`.

## Architecture
Add a `ModelsDialog` component driven by `/models`. It lists
`new ModelRegistry().getAll()` grouped by tier, shows active marker (current
`config.default.model`), and on Enter writes the selected model back via
`updateConfig` (set `default.model`). Reuses Phase 2's grouped-list rendering
conventions.

## Related Code Files
- Create: `src/cli/components/ModelsDialog.tsx`
- Modify: `src/cli/tui.tsx` — handle `/models` to open ModelsDialog
- Modify: `src/cli/slash-commands.ts` — wire `/models` to the dialog path
- Create: `src/cli/components/ModelsDialog.test.tsx`

## Implementation Steps
1. Build ModelsDialog: list registry models by tier, active marker, ↑/↓/Enter/Esc.
2. On Enter, `updateConfig((c) => ({ ...c, default: { ...c.default, model } }))`.
3. Route `/models` in the TUI to open the dialog (instead of just logging).
4. Test with ink-testing-library.

## Success Criteria
- [ ] `/models` opens a navigable, tier-grouped model picker
- [ ] Selecting a model updates `config.default.model` and is shown active next run
- [ ] Esc closes without changes
- [ ] ESLint clean, CI green

## Risk Assessment
- Writing config from TUI mutates `~/.zenocli/config.toml` — guard against
  partial writes; re-read after update.
