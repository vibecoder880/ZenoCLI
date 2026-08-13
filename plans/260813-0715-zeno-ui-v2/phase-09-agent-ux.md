# Phase 9 — Agent UX

**Status:** DONE
**Branch:** khanh

## Goal

Inline background agent lines per spec §31 and `docs/ui/component-spec.md § AgentActivity`. Shows running agents with status indicators, no panel.

## Scope

Component (`src/ui/components/AgentActivity.tsx`):
- `AgentInfo` interface — `id`, `name`, `status`.
- `AgentActivity` component — shows count header (`2 agents running`) + list of agents with status symbols (● running, ○ pending).
- Uses `resolveSymbols(unicode)` for portable symbols; themed colors via `useUiTheme()`.
- Returns `null` for empty agents.

Wiring (`src/ui/components/Conversation.tsx`):
- New optional prop `agents?` on `ConversationProps`.
- AgentActivity rendered after DiffBlock in the vertical flow.

## Tests

New: `components/AgentActivity.test.tsx` (4 tests) — running count, mixed status, empty, single agent.
Full `src/ui` green; `tsc` clean.

## Notes

- Agent activity lines live in the Conversation flow (not a separate panel) per spec.
- Full agent lifecycle events (start/progress/complete/error) are wired as props; event-driven updates are deferred to Shell integration.
