# Phase 10 — Statusline

**Status:** DONE
**Branch:** khanh

## Goal

Configurable statusline with all spec sections per `docs/ui/component-spec.md § Statusline`: `git branch* · model · context · tokens · cost · duration · agents`. Not a dashboard — one row, right-aligned.

## Scope

Enhanced existing component (`src/ui/components/Statusline.tsx`):
- New `agentCount` prop renders `"2 agents"` with accent color.
- Added `"agents"` to `WIDE_ORDER` for section ranking.
- Existing sections (branch, model, context, tokens, cost, duration) unchanged.
- Compact mode drops non-essential sections as before.

## Tests

Updated: `components/Statusline.test.tsx` (6 tests) — added agent count and singular agent tests.
Full `src/ui` green; `tsc` clean.

## Notes

- Statusline was already wired into Shell from Phase 2; no new wiring needed.
- Configurable section list (which sections to show) is a prop concern; full user config integration deferred to Phase 14 polish.
