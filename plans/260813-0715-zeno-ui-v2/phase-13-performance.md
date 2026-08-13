# Phase 13 — Performance

**Status:** IN PROGRESS
**Branch:** khanh

## Goal

Performance benchmarks and optimizations per `docs/ui/responsive.md § Performance budget`:
- Typing latency < 16 ms
- Streaming 100 token/s: batch updates; no full redraw per token
- 10k messages, 100k lines, 100 tool calls, 5 concurrent agents: UI stays responsive

## Scope

### 1. Virtualized transcript
Update `src/ui/components/Conversation.tsx`:
- Render only viewport + buffer (not entire 100k-line history)
- Use `useMemo` for visible message slicing based on terminal height
- Lazy rendering: only render messages near the viewport

### 2. Streaming batch updates
Update `src/ui/components/Conversation.tsx`:
- Batch streaming text updates (100 token/s → ~10 fps redraw, not per-token)
- Use `useRef` for accumulated text, flush on interval

### 3. Performance benchmarks
Create `src/ui/render/benchmarks.test.ts`:
- Typing latency benchmark: simulate 100 keystrokes, measure < 16ms per render
- Streaming benchmark: simulate 1000 token additions, measure render time
- Large conversation benchmark: 10k messages, measure initial render

### 4. Memory optimizations
- Ensure `useMemo`/`useCallback` for expensive computations
- Avoid unnecessary re-renders in conversation list
- Profile and optimize hot paths

## Files to modify/create

| File | Action |
|------|--------|
| `src/ui/components/Conversation.tsx` | MODIFY — virtualization + streaming batching |
| `src/ui/render/benchmarks.test.ts` | CREATE — performance benchmarks |
| `src/ui/components/Conversation.test.tsx` | MODIFY — add virtualization tests |

## Notes

- Virtualization is viewport-based (not scroll-based) — terminal height derived from Ink.
- Streaming batching uses `requestAnimationFrame` pattern (Ink-compatible).
- Benchmarks are vitest tests with timing assertions.
- Performance regressions caught by CI (benchmarks must pass).
