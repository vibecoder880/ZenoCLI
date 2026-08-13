# Phase 14 — Polish

**Status:** DONE ✅
**Branch:** khanh

## Goal

Final polish per `docs/ui/` spec: animations, hyperlinks (OSC 8), image protocol, accessibility, no-color mode.

## Scope

### 1. Animations
Update `src/ui/components/`:
- Streaming cursor blink animation (toggle every 500ms)
- Activity spinner animation (rotate through symbols)
- Smooth transitions for overlay open/close

### 2. Hyperlinks (OSC 8)
Update `src/ui/render/markdown-blocks.tsx`:
- Render markdown links as OSC 8 hyperlinks when `osc8=true`
- Fallback to plain URL text when OSC 8 unavailable
- Test with `osc8=true` and `osc8=false`

### 3. Accessibility
Update `src/ui/`:
- Screen reader support: aria labels for interactive elements
- High contrast mode: ensure tokens work in high contrast terminals
- Keyboard-only navigation: verify all actions accessible via keyboard

### 4. No-color mode
Update `src/ui/theme/provider.tsx`:
- `NO_COLOR=1` or `--no-color`: strip all ANSI colors
- Symbols (`✓ × ! ● ○`) carry state without color
- Test with `NO_COLOR=1` environment variable

### 5. Final tests
- Animation rendering tests
- OSC 8 hyperlink tests
- No-color mode tests
- Accessibility verification
- Full `src/ui` green; `tsc` clean.

## Files to modify/create

| File | Action |
|------|--------|
| `src/ui/components/Conversation.tsx` | MODIFY — streaming cursor animation |
| `src/ui/render/markdown-blocks.tsx` | MODIFY — OSC 8 hyperlink rendering |
| `src/ui/theme/provider.tsx` | MODIFY — no-color mode handling |
| `src/ui/components/Conversation.test.tsx` | MODIFY — animation tests |
| `src/ui/render/markdown-blocks.test.tsx` | MODIFY — OSC 8 tests |

## Notes

- Animations use `setInterval` for cursor blink (Ink-compatible).
- OSC 8 links use `]8;;url\\text]8;;\\` format.
- No-color mode already supported in theme engine; ensure all components respect it.
- Accessibility is best-effort for terminal UI (no formal ARIA in terminals).
