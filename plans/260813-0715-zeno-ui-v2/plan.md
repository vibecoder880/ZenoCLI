# Zeno UI v2 — plan

**Status:** Phase 0–9 DONE
**Branch:** khanh
**Docs home:** `docs/ui/`
**Source home:** `src/ui/`

## Decisions (user, /cook round)
- Deliver the full 53-section spec **phase-by-phase** across multiple `/cook` rounds.
- New UI lives in a **new `src/ui/` tree** (per spec §51), not a refactor in place.
- The ASCII welcome banner is replaced by a **minimal greeting** line.
- Model-lineup update (registry/pricing/config/providers/docs) landed first, CI-green (`e9b3171`).

## Phases
- **Phase 0 — UI/UX specification** (this round): `docs/ui/{principles,interaction,keyboard,theme,component-spec,responsive}.md`. No code.
- **Phase 1 — Renderer foundation** (this round): `src/ui/` theme engine, terminal capabilities, resize, keyboard manager, overlay manager.
- **Phase 2 — New App Shell**: App / Header / Conversation / Input / Statusline (v1 minimal).
- **Phase 3 — Conversation engine**: user/assistant messages, streaming, markdown, code, quiet tool activity, collapse, virtualized transcript.
- **Phase 4 — Composer**: text / `/` / `@` / `!` autocomplete, history, multiline, clipboard.
- **Phase 5 — Activity engine**: operational status lines replacing raw tool logs.
- **Phase 6 — Task UX**: inline task blocks (no panel).
- **Phase 7 — Diff UX**: inline diff, file navigation, syntax highlight.
- **Phase 8 — Overlay system**: unified overlay for command palette / model picker / theme picker / permission / session / file.
- **Phase 9 — Agent UX**: inline background-agent lines.
- **Phase 10 — Statusline**: configurable model / git / context / cost / duration.
- **Phase 11 — Theme engine**: System/native default, then Zeno Dark/Light, Tokyo, Nord, Dracula.
- **Phase 12 — Responsive**: 80/100/120/160/200 cols; Windows Terminal/PowerShell/WSL/VSCode/WezTerm.
- **Phase 13 — Performance**: 10k messages, 100k lines, 100 tool calls, 100 token/s streaming, 5 concurrent agents.
- **Phase 14 — Polish**: animations, hyperlinks (OSC 8), image protocol, accessibility, no-color mode.

## Acceptance criteria (Phase 0+1)
1. `docs/ui/*.md` capture the 10 anti-rules, semantic symbols, design tokens, keybindings, responsive breakpoints.
2. `src/ui/theme/` exposes `text | muted | subtle | accent | success | warning | error` tokens; default is terminal-native, not cyan.
3. Terminal capabilities detects truecolor, NO_COLOR, Unicode, OSC 8, width.
4. Keyboard manager + overlay manager are unit-tested; no TUI behavior regressions (existing `src/cli` tests still green).
5. CI verify green.

## Links
- Phase 0: `phase-00-ui-spec.md`
- Phase 1: `phase-01-renderer-foundation.md`
- Phase 2: `phase-02-app-shell.md`
- Phase 3: `phase-03-conversation-engine.md`
- Phase 4: `phase-04-composer.md`
- Phase 5: `phase-05-activity-engine.md`
- Phase 6: `phase-06-task-ux.md`
- Phase 7: `phase-07-diff-ux.md`
- Phase 8: `phase-08-overlay-system.md`
- Phase 9: `phase-09-agent-ux.md`
