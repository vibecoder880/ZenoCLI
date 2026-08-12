# Zeno UI v2 — Design Principles

Source of truth: Claude Code / OpenCode / Codex-inspired, terminal-native, typography-first.
This file is the "why". `component-spec.md` is the "what". `interaction.md` is the "how".

## The 10 anti-rules (never violated)

1. **No borders by default** — no `Box borderStyle`, no `─`, `│`, `╭`, `╰`. Radius = none.
2. **No ASCII boxes** — never wrap content in box-drawing panels.
3. **No permanent sidebar** — no always-open panel. Information is transient (overlay/command).
4. **No permanent dashboard** — the terminal is a single conversation screen, not a dashboard.
5. **No rainbow colors** — 90% of text is plain white/gray; the remaining ~10% carries semantic color.
6. **No noisy tool logs** — never stream raw `Tool call`/`Tool result` (tool name + args + blob) into the conversation.
7. **No giant ASCII logo** — no large ASCII art on launch. Minimum: a minimal greeting line.
8. **No unnecessary icons** — one semantic symbol set; see `principles.md § Symbols`.
9. **No modal unless an action requires it** — permission prompts, model picker, diff stay in-line or in a small transient overlay; terminal background is always visible.
10. **Information appears progressively** — progressively disclose detail (title → summary → Enter → detail).

## Hierarchy ladder

Hierarchy is built on typography, spacing, and position — not color:

1. **font weight** — regular text; bold for the current task/heading; no other weights.
2. **spacing** — 1 indent = 2 spaces; nested detail increments by 2.
3. **indentation + position** — primary content at column 0, secondary at 2, tertiary at 4.
4. **symbol** — the leading semantic glyph.
5. **color last** — accent/muted only to reinforce, never to carry meaning alone.

A grayscale terminal must remain fully usable: symbols and indentation carry the hierarchy.

## Progressive disclosure

Every block exposes a one-line summary. Enter/→ reveals one more level.

Example: test run
- Title: `Running tests…`
- After: `✓ 48 passed · 1 failed`
- Expand 1: `git --diff`/`tests/auth.test.ts`
- Expand 2: full stderr diff.

UX when an agent runs for 5 minutes: the screen stays clean — an operational status line, then completion summary. Never 300 lines of log.

## Operational status only

We display *operational* status, not chain-of-thought. Valid forms:

- `Inspecting repository…` → `✓ 12 files indexed`
- `Locating authentication flow…` → `✓ Found 8 references`
- `Implementing fix…` → `M src/auth.ts` `M src/token.ts`
- `Running tests…` → `● 48 passed · 1 failing`
- `Error ×` → `× Test failed` (stack trace expanded only on demand)

## Symbols (single vocabulary)

| Symbol | Meaning |
| --- | --- |
| `›` | user input / cursor / actionable scrollback object |
| `✓` | success / completed |
| `●` | active / in progress |
| `○` | pending |
| `×` | error |
| `!` | warning |
| `→` | implied action / next step |

No 30-icon vocabulary. Symbols are always printed even when colored, so `NO_COLOR=1` stays usable.

## Color (default theme)

| Token | Default value | Use |
| --- | --- | --- |
| `text` | terminal fg (soft white) | primary text |
| `muted` | gray | secondary, metadata |
| `subtle` | darkest gray | faint hints, placeholders |
| `accent` | very subtle purple | active model, brand, highlights |
| `success` | soft green | ✓ completion |
| `warning` | warm yellow | ! warning |
| `error` | soft red | × errors |

Rules:
- **90% of text has no color.**
- Primary hierarchy is weight/spacing/symbols; color is reinforcement.
- `NO_COLOR=1` / `zeno --no-color` forces grayscale; symbols still communicate state.
- Terminal-native default: Zeno does not override background; `system` theme uses the terminal's own palette (OpenCode direction).

## Animation

- Light. A single active glyph (`.` `..` `...`) or a spinner for streaming only.
- No long-running animation; every animation resolves to a static symbol (`✓`/`✗`) within one transition.
- No full-screen flicker; repaint only the changed line.

## Windows-first

Test matrix: Windows Terminal, PowerShell, CMD, WSL, WezTerm, VS Code terminal.
Must handle: Unicode fallback (`✓`→`OK` if the font lacks glyphs), truecolor fallback to 256/16, clipboard, OSC 8 hyperlinks, resize, mouse (opt-in).

## Render budget

- Typing latency < 16 ms; no full-screen redraw per token.
- Batch streaming updates; debounce resize; virtualize the transcript (viewport + buffer).
- If a model streams 50 token/s, the conversation must not re-render fully 50×/s.