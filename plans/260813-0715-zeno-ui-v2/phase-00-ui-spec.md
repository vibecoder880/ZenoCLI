# Phase 0 — UI/UX specification

**Status:** DONE

## Deliverables
`docs/ui/` (6 spec docs):
- `principles.md` — 10 anti-rules, hierarchy ladder, progressive disclosure, symbols, colors, animation, render budget.
- `interaction.md` — single-screen model, focus views, the 3 quiet rules, input, permission, overlays.
- `keyboard.md` — canonical keymap + keyboard-manager contract.
- `theme.md` — design tokens, system/native default, color-level fallback, theme engine API.
- `component-spec.md` — component tree, props, event model (`ZenoEvent`), `UIState`.
- `responsive.md` — width tiers, resize, virtualization, capability detection, Windows matrix, Unicode/NO_COLOR fallbacks.

## Validation
- No code written (spec only), per user's Phase 0 instruction.
- Anchored to the user's 53-section /cook doc: anti-rules §52, symbols §37, tokens §40, event model §29, component tree §31, responsive §23-24, statusline §18, theme §19-20.

## Notes
- The model-lineup update (`e9b3171`) landed and is CI-green before this phase started.
- Custom-theme JSON loading and `/theme` picker are Phase 11; composer is Phase 4; overlays are Phase 8.
