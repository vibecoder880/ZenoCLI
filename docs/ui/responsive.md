# Zeno UI v2 — Responsive & Terminal Capabilities

Zeno adapts to terminal width and platform. Never an "IDE clone" at wide widths — information is laid out horizontally, and the conversation stays centered.

## Width tiers

| Width | Header shows | Statusline shows | Conversation |
| --- | --- | --- | --- |
| `< 80` | `ZENO · model · branch` | nothing (hidden) | full-width |
| `80–120` | brand + model + branch | model · branch | full-width |
| `120–160` | brand + cwd + model + branch | + context % | centered, max ~120 |
| `> 160` | brand + cwd + branch + model · context | + tokens · cost · duration · agents | centered, max ~120 |

Rules:
- Never open a panel to "use" the width.
- Conversation column stays bounded (max ~120 cols) and centered on wide terminals.
- Wide = more statusline sections, not more chrome.

Example at 180 cols:

```
ZENO       ~/Projects/ZenoCLI       main*       Sonnet 5 · 18k/128k
                                                                  $0.06
```

## Resize behavior

- Debounce resize (~150 ms) before re-layout.
- Keep scroll position relative to the focused block; no full-screen repaint.
- Transient overlays clamp to the new width.

## Virtualized transcript

- Render viewport + buffer only; never the whole 100k-line history.
- Window height is derived from terminal height, not hard-coded.
- `100k lines` stays responsive (Phase 13 target).

## Terminal capability detection

`src/ui/terminal/capabilities.ts` must detect and expose:

| Capability | Detection | Fallback |
| --- | --- | --- |
| truecolor | `COLORTERM` = `truecolor` / `24bit` | 256-color, then 16, then none |
| `NO_COLOR` | `NO_COLOR` env or `--no-color` flag | — |
| Unicode | font/TERM probe (best-effort) | ASCII map: `✓→OK`, `×→X`, `●→*`, `›→>` |
| OSC 8 links | `TERM`/`WT_SESSION`/KITTY_WINDOW_ID heuristic | plain URL text |
| width / height | Ink `useStdout` `columns`/`rows` | 80×24 |
| Windows console | `process.platform === "win32"` + `WT_SESSION` | enable VT (via `enable` on conout) |

`UnicodeFallback` replaces the semantic glyphs when the terminal lacks them, so symbols still read as state.

## Platform test matrix (Windows-first)

| Terminal | Must pass |
| --- | --- |
| Windows Terminal | truecolor, resize, OSC 8, mouse |
| PowerShell | VT enable, Unicode fallback |
| CMD | 16-color fallback, ASCII fallback |
| WSL | truecolor, resize |
| WezTerm | truecolor, OSC 8, sixel (future) |
| VS Code terminal | truecolor, links, image (future) |

## Unicode fallback map

```
✓ → OK    × → X    ● → *    ○ → o    › → >    → → ->    … → ...    · → .
```

## NO_COLOR

- `NO_COLOR=1` or `zeno --no-color`: strip ANSI; symbols (`✓ × ! ● ○`) carry state.
- Not dependent on color: `× Error`, `✓ Success` always print.
- Resize/fallback logic is unaffected by color mode.

## Performance budget (Phase 13 targets)

- Typing latency < 16 ms.
- Streaming 100 token/s: batch updates; no full redraw per token.
- 10k messages, 100k lines, 100 tool calls, 5 concurrent agents: UI stays responsive.
- Benchmarks live in `src/ui/render/` and run via `vitest`.