# Phase 5 — Activity engine

**Status:** DONE (CI verify pending)
**Branch:** khanh

## Goal

Replace the raw tool-log (`> tool` / `+ result` / `✗ error`) with an
aggregated Activity stream per spec §30 and `docs/ui/component-spec.md` § Activity.
Operational status lines show summaries (`✓ Read 4 files`) with progressive
disclosure; errors always expand.

## Scope

Pure aggregator (`src/ui/activity/types.ts`, React-free, unit-tested):
- `ActivityLine` interface — `id`, `toolName`, `summary`, `detail`, `expanded`,
  `status` ("ok"/"error"/"running"), `timestamp`.
- `ActivityAggregator` class — `process(AgentEvent)` merges `tool_start` +
  `tool_result` into one line per toolName; extracts file paths from output for
  summaries; marks errors; preserves invocation order; `toggle()` and `clear()`.
  KISS: summary is `✓ toolName (count)`, detail is newline-joined file paths.

Component (`src/ui/components/Activity.tsx`):
- Renders `ActivityLine[]` in the Conversation flow, no box, muted text.
- Collapsed by default; expanded when `expanded=true` (errors auto-expand).
- Focused line indicator via `bold + inverse`.

Wiring (`src/ui/components/Conversation.tsx`):
- New optional props `activityLines?` and `focusedActivityIndex?`.
- Activity block appended after messages in the vertical flow.

## Tests

New: `activity/types.test.ts` (7), `components/Activity.test.tsx` (6).
Full `src/ui` green; `tsc` + `eslint` clean.

## Notes

- Activity lines live in the Conversation flow (not a separate panel) per spec.
- Progressive disclosure via keyboard (Enter to expand/collapse) is deferred to
  Phase 14 polish — the visual structure is here; the current implementation
  auto-expands errors and keeps success lines collapsed.
- File-path extraction is best-effort regex over tool output; exotic tool
  output won't populate detail but the summary still works.
