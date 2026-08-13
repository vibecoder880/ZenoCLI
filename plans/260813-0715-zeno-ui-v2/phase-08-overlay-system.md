# Phase 8 — Overlay system

**Status:** DONE
**Branch:** khanh

## Goal

Unified overlay system for command palette, model picker, theme picker, permission prompt, session picker, help per spec §31 and `docs/ui/component-spec.md § OverlayLayer`.

## Scope

State (`src/ui/state/overlay-manager.ts`, pre-existing from Phase 1):
- `OverlayManager` class — `open()`, `close()`, `move()`, `clear()`.
- `OverlayState` interface — `kind`, `items`, `selectedIndex`, `title`.

Component (`src/ui/components/OverlayLayer.tsx`):
- Renders overlay items with selection indicator (●), themed colors.
- Permission prompt has special layout with action hints (Enter/a/d/e).
- Standard list overlays show items with bold+accent for selected.
- Returns `null` when overlay is null.

Wiring (`src/ui/app/Shell.tsx`):
- New optional prop `overlay?` on `ShellProps`.
- OverlayLayer rendered after Composer in the vertical flow.

## Tests

New: `components/OverlayLayer.test.tsx` (5 tests) — palette, selection, permission, null, title.
Existing: `state/overlay-manager.test.ts` (6 tests) unchanged.
Full `src/ui` green; `tsc` clean.

## Notes

- Interactive keyboard handling (Up/Down/Enter/Esc) for overlays is wired via props but full integration with KeyboardManager is deferred to Phase 14 polish.
- Overlay is positioned above the input area per spec — no ASCII boxes.
