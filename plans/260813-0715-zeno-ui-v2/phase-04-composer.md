# Phase 4 — Composer

**Status:** DONE (CI verify pending)
**Branch:** khanh

## Goal

Replace the v1 single-line `ink-text-input` Prompt with a full v2 Composer
behind `ZENO_UI_V2=1`: multiline input (Shift+Enter), trigger autocomplete
(`/` commands, `@` files, `!` shell), prompt history (Up/Down), and an
under-line Autocomplete — per spec §16 and `docs/ui/keyboard.md` § Composer.

## Scope

Pure input logic (`src/ui/input/`, React-free, unit-tested):
- **`suggestions.ts`** — `parseTrigger` (leading `/@!` after start or
  whitespace, `prefix` keeps the trailing space), `filterSuggestions`
  (slash catalog via v1 `buildSlashCommands`, `@` file listing under cwd with
  directories first, `!` shell shortcuts), `applySuggestion` (replace token
  in place + trailing space).
- **`history.ts`** — `PromptHistory` ring buffer (max=100, dedupe consecutive
  empties, Up/Down navigation cursor).

Components (`src/ui/components/`):
- **`Autocomplete.tsx`** — suggestion rows under the line, no box; selected row
  inverted; trigger-label header (`→ command` / `file` / `shell`).
- **`Composer.tsx`** — owns input handling via `useInput` (multiline
  Shift+Enter, Tab accepts, Up/Down navigates suggestions or history, renders
  a `▍`/`|` cursor, muted placeholder when empty, disabled during busy).

Wiring:
- **`src/ui/app/Shell.tsx`** renders `Composer` (with `cwd` for `@` paths)
  instead of the v2 `Input`. `Input.tsx` is kept for back-compat but is no
  longer on the default shell path.

## Tests

New: `suggestions.test.ts` (5), `history.test.ts` (5), `Composer.test.tsx` (6).
Full `src/ui` 108/108 and `src/cli` green; `tsc` + `eslint` clean.

## Notes / Deviations

- `ink-text-input` v6 is single-line only and cannot host history/triggers, so
  the Composer owns key handling directly (KISS over a heavyweight input lib).
- Cursor sits at end-of-line; full left/right cursor movement is a later-phase
  polish item (Phase 14) per spec.
- `@` file completion lists workspace paths from `cwd`; symlink/hidden-file
  nuance is out of scope for this phase.