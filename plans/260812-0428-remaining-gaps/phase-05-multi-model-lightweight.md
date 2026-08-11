---
phase: 5
title: "Lightweight model for metadata"
status: pending
priority: P1
dependencies: []
---

# Phase 5: Lightweight model for metadata

## Overview
Use a cheap/fast model (economy tier) for low-stakes tasks — conversation title
generation, subagent summaries, tool-result compaction — reserving the main
premium model for the primary agent reasoning. Reduces cost and latency.

## Requirements
- Functional: a `--metadata-model <model>` option / `config.metadataModel` picks
  an economy-tier model (default `openai/gpt-4o-mini`) for non-critical calls.
- Functional: title generation (session) and subagent summaries use the
  lightweight model when available.
- Non-functional: no behavior change for main agent; falls back to the main
  model when the economy route is unavailable.

## Architecture
Add a helper `resolveMetadataModel(config)` that returns an economy-tier route
(via the existing `SmartRouter` cost strategy or `config.metadataModel`), falling
back to `default.model`. Use it in:
- session title generation (currently title from prompt, or `chat`-level call)
- `spawnTypedSubagent` summary refinement (optional)
- any compaction-summary call

## Related Code Files
- Modify: `src/storage/config.ts` — add `metadataModel?` to config
- Modify: `src/providers/router.ts` — add `resolveMetadataModel()` using cost strategy
- Modify: `src/core/session.ts` (or where titles are generated) — use metadata model
- Create: `src/providers/metadata-model.test.ts`

## Implementation Steps
1. Add `metadataModel?: string` to `ZenoConfig` + default.
2. `resolveMetadataModel(config)`: prefer explicit, else SmartRouter cost-strategy
   economy model; fall back to default.
3. Wire into title generation call site (find where session titles are made).
4. Test: default returns economy model; explicit override respected; fallback.

## Success Criteria
- [ ] Session titles generated via economy model when available
- [ ] Main agent model unchanged
- [ ] Fallback works when economy route unavailable
- [ ] CI green

## Risk Assessment
- Finding the title-generation call site requires scout during implementation.
- Must not degrade title quality — economy models are adequate for short titles.
