# Phase 2 — New App Shell

**Status:** DONE (CI verify pending)
**Branch:** khanh

## Goal

Deliver the v2 App Shell: `Header` / `Conversation` / `Input` / `Statusline`
composed by `Shell`, themed through the v2 engine, and wired into the TUI behind
the `ZENO_UI_V2=1` opt-in flag (v1 remains the default — no regression risk).

## Scope

Presentation-only shell per spec §3, §31 and `docs/ui/component-spec.md`:
- **`src/ui/theme/provider.tsx`** — `UiThemeProvider` / `useUiTheme()` returning a
  `ResolvedTheme { palette, colorLevel, noColor, nativeBackground }`.
- **`src/ui/components/Header.tsx`** — compact ≤2-line header: brand + version,
  `provider/model`, git branch, status, cwd, context %. Exports `VERSION` read
  from `package.json` at module load (mirrors the v1 Header).
- **`src/ui/components/Statusline.tsx`** — ordered sections with `compact`
  filtering; empty sections render nothing.
- **`src/ui/components/Conversation.tsx`** — `ChatLine`, `UserMessage` (semantic
  `›` prefix), `AssistantMessage`, minimal `Greeting`, `Conversation` with
  `maxVisible`.
- **`src/ui/components/Input.tsx`** — input with `symbols.user` prefix + ink text
  input.
- **`src/ui/app/Shell.tsx`** — composes Header / Conversation-or-Greeting / Input
  / Statusline inside `UiThemeProvider`, with detected capabilities and `compact`
  width handling.

Wiring:
- **`src/cli/tui.tsx`** — `ZENO_UI_V2=1` renders `<Shell>` with live route/message/
  context state; otherwise the v1 tree renders unchanged.

## Files

Created: `src/ui/theme/provider.tsx`, `src/ui/app/Shell.tsx`,
`src/ui/components/{Header,Statusline,Conversation,Input}.tsx`,
tests `Header.test.tsx` / `Statusline.test.tsx` / `Shell.test.tsx`.
Modified: `src/cli/tui.tsx` (static imports of `Shell`/`VERSION`, `execSync` for
git branch, v2 render branch).

## Tests / Validation

- `npx tsc --noEmit` — clean.
- `npx vitest run src/ui src/cli` — 30 files / 116 tests pass (no v1 regression).
- `npx eslint src/ui src/cli` — clean.
- CI verify after push.

## Notes / Deviations

- v2 Shell is deliberately wired behind an env flag so the default launch path
  is untouched; flipping the default is a later-phase decision.
- `Header` owns `VERSION` (module-scope `createRequire`) rather than threading it
  through props, matching the v1 component's pattern.
