---
phase: 2
title: "TUI command palette"
status: pending
priority: P1
dependencies: []
---

# Phase 2: TUI command palette

## Overview
Upgrade the slash palette to opencode/claude-code caliber: fuzzy-ish filter,
grouped sections with visible category headers, keyboard navigation (↑/↓/Tab/
Enter/Esc), and recent-command ordering. Improves discoverability of the 21
existing slash commands.

## Requirements
- Functional: typing `/` opens the palette; substring match is case-insensitive;
  result list shows command + description + category badge.
- Functional: ↑/↓ navigate, Tab fills the highlighted command, Enter runs, Esc closes.
- Functional: recently used commands float to the top of their group.
- Non-functional: reuse the existing `SlashMenu` + `filterSlashCommands`; no new
  dependency; Ink-only.

## Architecture
The current `SlashMenu.tsx` renders the filtered list. Enhance it with:
- category grouping rendered as sticky-ish headers (already have `getSlashCommandsByCategory`)
- a small recency tracker (in-memory, session-scoped) that reorders matches
- key handling via Ink's `useInput` (↑/↓/Tab/Enter/Esc)

## Related Code Files
- Modify: `src/cli/components/SlashMenu.tsx` (grouped rendering + recency)
- Modify: `src/cli/slash-commands.ts` (export a recency-aware filter helper)
- Create: `src/cli/components/SlashMenu.test.tsx` (ink-testing-library: filter,
  navigate, enter)

## Implementation Steps
1. Add recency tracking to slash-commands (in-memory Set of used commands).
2. Update SlashMenu to group by category with headers and reorder by recency.
3. Wire ↑/↓/Tab/Enter/Esc in useInput.
4. Test with ink-testing-library.

## Success Criteria
- [ ] Palette groups commands under Mode/Session/Debug/Info headers
- [ ] Recent commands appear first; keyboard nav works
- [ ] Existing `/` behavior unchanged for single-match commands
- [ ] ESLint clean, CI green

## Risk Assessment
- Keyboard conflicts with the existing Prompt input — scope useInput to when the
  palette is open.
