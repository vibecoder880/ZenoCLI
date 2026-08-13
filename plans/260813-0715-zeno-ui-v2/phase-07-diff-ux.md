# Phase 7 — Diff UX

**Status:** DONE
**Branch:** khanh

## Goal

Inline diff viewer with multi-file support, summary stats, and file navigation per spec §31 and `docs/ui/component-spec.md § DiffBlock`.

## Scope

Pure parser (`src/ui/render/diff-parse.ts`, React-free, unit-tested):
- `DiffLine`, `DiffHunk`, `DiffFile`, `DiffStats` interfaces.
- `parseDiff(text)` — parses unified diff text into structured `DiffStats` with per-file added/removed counts.
- `diffSummary(stats)` — `"3 files changed · +42 −11"` summary line.

Component (`src/ui/components/DiffBlock.tsx`):
- Renders `DiffStats` with file headers, summary line, focused file indicator (●), and color-coded +/- lines.
- Uses `resolveSymbols(unicode)` for portable symbols; themed colors via `useUiTheme()`.
- Returns `null` for empty diffs.

Wiring (`src/ui/components/Conversation.tsx`):
- New optional props `diffText?` and `focusedDiffFileIndex?`.
- DiffBlock rendered after TaskBlock in the vertical flow.

## Tests

New: `render/diff-parse.test.ts` (8), `components/DiffBlock.test.tsx` (6).
Full `src/ui` green (20 files, 141 tests); `tsc` clean.

## Notes

- Multi-file diff detection uses `diff --git` header lines.
- File navigation (Enter/Up/Down) and accept/reject callbacks are wired as props but interactive behavior is deferred to Phase 14 polish.
- Inline syntax highlight for code in diff lines deferred to Phase 14.
