---
phase: 3
title: "TUI diff viewer"
status: pending
priority: P1
dependencies: []
---

# Phase 3: TUI diff viewer

## Overview
Render unified diffs in the TUI with syntax-aware coloring (+green / -red / context
dim), shown when the agent edits files. Improves on the plain-text message bubbles
for code-change feedback.

## Requirements
- Functional: detect unified-diff blocks in assistant/tool-result content and
  color `+`/`-`/context lines distinctly.
- Functional: a `/diff` slash command or automatic detection when the agent
  returns a diff.
- Non-functional: no new dependency — parse unified diff lines and color via Ink
  `<Text color>`. Preserve current message layout.

## Architecture
Add a `DiffView` component that parses a unified diff string (lines starting
`diff --git`, `@@`, `+`, `-`, space, `\ No newline`) and renders each line with
the right color. MessageList detects diff blocks (content contains `@@ ... @@`)
and renders `DiffView` instead of plain `<Text>` for that segment.

## Related Code Files
- Create: `src/cli/components/DiffView.tsx` (parse + color unified diff)
- Create: `src/cli/components/DiffView.test.tsx` (ink-testing-library)
- Modify: `src/cli/components/MessageList.tsx` (use DiffView for diff content)
- Modify: `src/cli/slash-commands.ts` (optional `/diff` to show last tool diff)

## Implementation Steps
1. Implement `parseUnifiedDiff(text): Array<{type:"add"|"del"|"ctx"|"hunk"|"meta", text}>`.
2. `DiffView` renders each line with `+`=green, `-`=red, context=dim, `@@`=cyan.
3. In MessageList, detect diff content and render `DiffView`.
4. Add `/diff` slash command (optional) to surface the last diff.
5. Test with ink-testing-library: colored output for a sample diff.

## Success Criteria
- [ ] Agent tool results containing diffs render with +green/-red
- [ ] Non-diff messages unchanged
- [ ] ESLint clean, CI green (test renders in node env)

## Risk Assessment
- Ink color rendering in tests: use `ink-testing-library` `lastFrame()`.
- Diff parsing must not break on malformed input (fall back to plain text).
