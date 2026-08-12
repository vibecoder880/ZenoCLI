# Phase 1 — Renderer foundation

**Status:** DONE

## Deliverables
New `src/ui/` tree (spec §51):
- `theme/tokens.ts` — `ZenoTokens` (`text|muted|subtle|accent|success|warning|error`), spacing scale, `BORDER/RADIUS = none`.
- `theme/engine.ts` — `resolveTheme()` for `system|dark|light|named`; native-ANSI tokens on terminal-native background, Zeno Dark fallback; palette overrides.
- `terminal/system.ts` — `detectCapabilities()` (truecolor/256/16/none, NO_COLOR, Unicode, OSC 8, dimensions, native background), pure over env/stdout.
- `terminal/resize.ts` — debounced `ResizeObserver`, `widthTier()`, `isCompact()`.
- `render/markdown.ts` — Unicode↔ASCII symbol map (`resolveSymbols`, `ascii`).
- `render/animation.ts` — light `thinkingFrame()` cycling glyph.
- `keyboard/bindings.ts` + `manager.ts` — data-driven keymap, focus state, interrupt marker (`interruptRequested`/`consumeInterrupt`).
- `state/overlay-manager.ts` — unified `OverlayManager` + `UIState`.
- `index.ts` — public surface barrel.
- Tests: 6 files, 47 tests (engine 8, system 13, resize 5, keyboard 11, overlay 6, symbols 4).

## Validation
- `npx tsc --noEmit` clean.
- `npx eslint src/ui` clean (1 unused-import fixed).
- `npx vitest run src/ui` — 47/47 pass.
- `npx vitest run src/cli` — 57/57 pass (no regression to existing TUI).

## Notes
- This phase adds the foundation only; nothing is wired into `src/cli/tui.tsx` yet (Phase 2 starts that).
- Native `system` theme uses ANSI keyword tokens (white/gray/magenta/green/yellow/red) so Ink/ANSI resolves them to the terminal's own palette; fallback is Zeno Dark.
- `docs/ui/` spec (Phase 0) is the source of truth for all contracts.
