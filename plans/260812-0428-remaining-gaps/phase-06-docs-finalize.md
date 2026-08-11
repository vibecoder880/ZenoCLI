---
phase: 6
title: "Docs finalize"
status: pending
priority: P2
dependencies: [1, 2, 3, 4, 5]
---

# Phase 6: Docs finalize

## Overview
Update README + architecture doc to cover the features added across the recent
slices (headless chat, code review, diff viewer, device code, lightweight model)
and keep the docs consistent with the final behavior. Runs last so docs reflect
all completed phases.

## Requirements
- Functional: README documents all new CLI commands/flags.
- Functional: docs/architecture.md module map is accurate.
- Non-functional: verify dates/links/claims; follow `documentation-management.md`.

## Architecture
`docs-manager` subagent reviews the diff of all phases and updates:
- `README.md` — new commands (`zeno review`, chat `--non-interactive`), device
  flow flag, diff viewer note.
- `docs/architecture.md` — new modules (device-code, review command, DiffView,
  metadata model) in the module map.
- `CHANGELOG.md` — a 0.7.4 entry once phases land (if a release is planned).

## Related Code Files
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `CHANGELOG.md` (optional version entry)

## Implementation Steps
1. Read current README + architecture.
2. Add sections for each completed phase's user-visible behavior.
3. Update architecture module map.
4. Verify links/dates/claims against actual files.
5. Commit docs in English; CI green.

## Success Criteria
- [ ] README covers all new commands/flags
- [ ] Architecture module map matches source
- [ ] No stale/outdated claims
- [ ] CI green

## Risk Assessment
- Low risk; doc-only. Verify links resolve (use relative `./` paths).
