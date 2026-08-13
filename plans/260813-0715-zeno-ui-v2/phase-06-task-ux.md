# Phase 6 — Task UX

**Status:** DONE
**Branch:** khanh

## Goal

Inline task/plan blocks per spec §31 and `docs/ui/component-spec.md § TaskBlock`. No panel — just content in the conversation flow.

## Scope

Component (`src/ui/components/TaskBlock.tsx`):
- `TaskItem` interface — `id`, `label`, `status` (done/active/pending).
- `TaskBlock` component — collapsed summary (`Plan · 3/5 complete (in progress)`) or expanded list with status symbols (✓/●/○).
- Uses `resolveSymbols(unicode)` for portable symbols; themed colors via `useUiTheme()`.
- Returns `null` when items empty.
- Exported helper `createTaskItem(id, label, status)`.

Wiring (`src/ui/components/Conversation.tsx`):
- New optional props `taskItems?`, `taskExpanded?`, `taskTitle?`.
- TaskBlock rendered after Activity in the vertical flow.

## Tests

New: `components/TaskBlock.test.tsx` (6 tests) — collapsed summary, expanded list, active indicator, empty items, all done.
Full `src/ui` green (18 files, 127 tests); `tsc` clean.

## Notes

- TaskBlock is purely presentational — state ownership is in Shell/event bus.
- Progressive disclosure (Enter to expand/collapse) deferred to Phase 14 polish.
