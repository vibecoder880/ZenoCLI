---
phase: 2
title: "Code review command"
status: pending
priority: P1
dependencies: [1]
---

# Phase 2: Code review command

## Overview
Add `zeno review` — run the agent loop with a code-review persona and headless
output so it can gate PRs in CI. Reuses Phase 1 headless plumbing.

## Requirements
- Functional: `zeno review <target>` (file, dir, or `--diff <ref>` for staged/uncommitted) runs a review and prints findings.
- Functional: `--non-interactive` for CI; exit 0 if no high-severity findings, non-zero otherwise.
- Functional: reviews use the existing `reviewer` persona (`src/agents/`).
- Non-functional: no new dependency; reuses `runAgentLoop`.

## Architecture
Reuse the existing `spawnTypedSubagent("reviewer", ...)` (read-only + run_command,
reviewer persona from `src/agents/reviewer.md`). `zeno review <target>` builds
the task and emits the subagent's summary via Phase 1 headless output. A
`--diff <git-ref>` option collects changed files via `git diff --name-only` and
passes them as review context. Because `spawnTypedSubagent` returns a summary
(not the full loop), severity → exit-code mapping is done on keywords in the
output (e.g. "P0"/"high severity"/"critical").

## Related Code Files
- Create: `src/cli/commands/review.ts` (register `zeno review`)
- Modify: `src/index.ts` (register review command + flags)
- Reuse: `spawnTypedSubagent` from `src/agent/subagent.ts` (already supports
  the `reviewer` preset) + Phase 1 headless output
- Create: `src/cli/commands/review.test.ts`

## Implementation Steps
1. `runReviewCommand(target?, { diff?, nonInteractive? })`: if `diff` given,
   collect changed files via `git diff --name-only <ref>`; else review target.
2. Build task prompt from reviewer persona + changed-files context.
3. Call `spawnTypedSubagent("reviewer", { provider, cwd, task, ... })`.
4. Emit subagent output via Phase 1 headless printer; map severity keywords to
   exit code.
5. Register command in `src/index.ts`.
6. Test: file target, `--diff` path, exit-code behavior.

## Success Criteria
- [ ] `zeno review <file>` produces findings; `--non-interactive` is CI-clean
- [ ] `zeno review --diff HEAD~1` reviews changed files
- [ ] Exit code reflects findings severity
- [ ] CI green

## Risk Assessment
- Persona/tools integration with the loop must not bypass permission checks.
- Diff collection assumes a git repo — handle non-git gracefully.
